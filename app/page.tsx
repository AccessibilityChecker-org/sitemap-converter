"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ServerEvent =
  | { type: "stage"; msg: string }
  | { type: "bytes"; n: number }
  | { type: "meta"; finalUrl: string; contentType: string; totalBytes: number | null }
  | { type: "link"; href: string; index: number }
  | { type: "done"; count: number; url: string; links: string[] }
  | { type: "error"; error: string };

const CLASSIFIER_URL = "https://ace-sitemap-page-classifier.vercel.app/";

function shortPath(href: string) {
  try {
    const u = new URL(href);
    const p = (u.pathname + u.search).replace(/^\//, "");
    return p || "(root)";
  } catch {
    return href;
  }
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

type StageKey = "load" | "fetch" | "extract" | "export";

export default function Page() {
  const [url, setUrl] = useState("");
  const [timeoutValue, setTimeoutValue] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [domain, setDomain] = useState("—");
  const [issued, setIssued] = useState("—");
  const [finalCount, setFinalCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [stageMsg, setStageMsg] = useState<string>("");
  const [bytes, setBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [activeStage, setActiveStage] = useState<StageKey | null>(null);

  const manifestRef = useRef<HTMLDivElement | null>(null);
  const handoffRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progressLog, links.length, bytes]);

  const showToast = (msg: string, duration = 2000) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
  };

  const appendLog = (line: string) =>
    setProgressLog((prev) => [...prev, line]);

  const filteredLinks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return links.map((href, i) => ({ href, i, visible: true }));
    return links.map((href, i) => ({
      href,
      i,
      visible: href.toLowerCase().includes(q),
    }));
  }, [links, filter]);

  const resetRun = () => {
    setLinks([]);
    setFinalCount(0);
    setFinished(false);
    setErrorMsg(null);
    setStageMsg("");
    setBytes(0);
    setTotalBytes(null);
    setProgressLog([]);
    setActiveStage("load");
  };

  const deriveStage = (msg: string): StageKey => {
    const m = msg.toLowerCase();
    if (m.includes("resolving") || m.includes("dispatching") || m.includes("connecting")) return "load";
    if (m.includes("redirect") || m.includes("downloading") || m.includes("connected")) return "fetch";
    if (m.includes("parsing") || m.includes("scanning") || m.includes("sorting")) return "extract";
    if (m.includes("done") || m.includes("manifest")) return "export";
    return activeStage || "load";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    resetRun();
    appendLog(`▸ Dispatching request to ${trimmed}`);
    setStageMsg("Connecting…");

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, timeout: timeoutValue }),
      });

      if (!res.body) throw new Error("No response body from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: string[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handleEvent(JSON.parse(line) as ServerEvent, collected);
          } catch {
            /* ignore */
          }
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer) as ServerEvent, collected);
        } catch {
          /* ignore */
        }
      }
    } catch (err: any) {
      setErrorMsg(`Network error — ${err?.message || err}`);
      appendLog(`✕ Network error — ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvent = (evt: ServerEvent, collected: string[]) => {
    switch (evt.type) {
      case "stage":
        setStageMsg(evt.msg);
        setActiveStage(deriveStage(evt.msg));
        appendLog(`· ${evt.msg}`);
        break;
      case "meta": {
        try {
          setDomain(new URL(evt.finalUrl).hostname);
        } catch {
          setDomain("—");
        }
        setTotalBytes(evt.totalBytes);
        appendLog(
          `· Final URL: ${evt.finalUrl} (${evt.contentType}${
            evt.totalBytes ? `, ${formatBytes(evt.totalBytes)}` : ""
          })`
        );
        break;
      }
      case "bytes":
        setBytes(evt.n);
        setActiveStage("fetch");
        break;
      case "link":
        collected.push(evt.href);
        setActiveStage("extract");
        if (collected.length % 25 === 0 || collected.length <= 25) {
          setLinks([...collected]);
        }
        break;
      case "done": {
        setLinks(evt.links);
        setFinalCount(evt.count);
        const d = new Date();
        setIssued(
          `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
        );
        setStageMsg(
          `Done — ${evt.count} internal address${evt.count === 1 ? "" : "es"} catalogued.`
        );
        appendLog(`✓ Manifest issued. ${evt.count} link(s).`);
        setFinished(true);
        setActiveStage("export");
        showToast(
          `✓ Scan complete — ${evt.count} link${evt.count === 1 ? "" : "s"} found`,
          3500
        );
        setTimeout(() => {
          manifestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
        break;
      }
      case "error":
        setErrorMsg(evt.error);
        appendLog(`✕ ${evt.error}`);
        setStageMsg("Failed.");
        setActiveStage(null);
        break;
    }
  };

  const handleCopy = async () => {
    if (!links.length) return;
    await navigator.clipboard.writeText(links.join("\n"));
    showToast(`✓ Copied ${links.length} link${links.length === 1 ? "" : "s"}`);
  };

  const handleDownload = async (format: "txt" | "xml") => {
    if (!links.length) return;
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links, format }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = format === "xml" ? "sitemap.xml" : "sitemap-manifest.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(format === "xml" ? "↓ sitemap.xml downloaded" : "↓ Manifest downloaded");
  };

  const handleSendToClassifier = async () => {
    if (!links.length) return;

    // Handoff protocol v1: pass URLs to the classifier via URL hash so they
    // never hit the server and have no practical length limit. The classifier
    // reads #ace-import=<base64-json> on mount, switches to PASTE URLS, fills
    // the textarea, and shows a confirmation popup.
    const payload = {
      v: 1,
      source: "ace-sitemap-converter",
      source_url: window.location.origin,
      count: links.length,
      urls: links,
      issued_at: new Date().toISOString(),
    };
    const json = JSON.stringify(payload);
    // base64url — safe inside a URL fragment
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const handoffUrl = `${CLASSIFIER_URL}#ace-import=${b64}`;

    // Best-effort clipboard fallback in case the classifier build is older
    // and doesn't understand the hash protocol yet.
    try {
      await navigator.clipboard.writeText(links.join("\n"));
    } catch {
      /* ignore */
    }

    showToast(
      `↗ Opening ACE classifier · sending ${links.length} URL${links.length === 1 ? "" : "s"}…`,
      4000
    );
    window.open(handoffUrl, "_blank", "noopener,noreferrer");
  };

  const paddedCount = String(finished ? finalCount : links.length).padStart(3, "0");
  const pct =
    totalBytes && totalBytes > 0
      ? Math.min(100, Math.round((bytes / totalBytes) * 100))
      : null;

  const liveVisible = submitting || errorMsg || progressLog.length > 0;
  const statusKind: "loading" | "error" | "success" = errorMsg
    ? "error"
    : finished
    ? "success"
    : "loading";

  const stageClass = (s: StageKey) => {
    if (!activeStage && !finished) return "";
    const order: StageKey[] = ["load", "fetch", "extract", "export"];
    const active = activeStage ?? "export";
    const ai = order.indexOf(active);
    const si = order.indexOf(s);
    if (finished) return "done";
    if (si < ai) return "done";
    if (si === ai) return "active";
    return "";
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-pill">Accessibility Checker</span>
          <span className="brand">
            ACE<span className="slash">//</span>Sitemap Converter
          </span>
        </div>
        <div className="topbar-right">
          <span className="pill">Internal</span>
          <span className="pill ok">System OK</span>
        </div>
      </header>

      <main className="frame">
        <div className="hero-line">
          <span className="prompt">$&gt; ace-converter</span>
          <span className="sep">—</span>
          <span>build.v1</span>
          <span className="sep">—</span>
          <span>ready</span>
        </div>

        <h1 className="hero-title">
          HTML<span className="slash">→</span>XML
          <br />
          Sitemap <span className="hl">Converter.</span>
        </h1>

        <p className="hero-lede">
          Some websites don&apos;t have a machine-readable <strong>sitemap.xml</strong>. Instead, they list their pages on a regular HTML page — a visual &ldquo;site map&rdquo; built for humans, not crawlers. This tool reads that HTML page, extracts every internal link, and converts them into a proper <strong>sitemap.xml</strong> that the{" "}
          <a href="https://accessibilitychecker.org" target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)", borderBottom: "1px solid var(--green)" }}>
            AccessibilityChecker.org
          </a>{" "}
          scanner can understand.
        </p>

        <div className="stages">
          <div className={`stage ${stageClass("load")}`}>
            <span className="stage-num">Stage 01</span>
            <span className="stage-name">Fetch HTML</span>
          </div>
          <div className={`stage ${stageClass("fetch")}`}>
            <span className="stage-num">Stage 02</span>
            <span className="stage-name">Download</span>
          </div>
          <div className={`stage ${stageClass("extract")}`}>
            <span className="stage-num">Stage 03</span>
            <span className="stage-name">Extract Links</span>
          </div>
          <div className={`stage ${stageClass("export")}`}>
            <span className="stage-num">Stage 04</span>
            <span className="stage-name">Export XML</span>
          </div>
        </div>

        {/* SECTION 1 — LOAD SITEMAP */}
        <section className="card">
          <div className="card-head">
            <span className="card-num">1</span>
            <span className="card-eyebrow">Section 1</span>
            <div className="card-head-right">
              <button
                type="button"
                className="chip demo"
                onClick={() => setUrl("https://www.wmh.org/site-map/")}
              >
                Demo · WMH Hospital
              </button>
            </div>
          </div>
          <h2 className="card-title">Paste the HTML Sitemap URL</h2>

          <div className="card-body">
            <form onSubmit={handleSubmit} autoComplete="off">
              <p className="hint" style={{ marginTop: 0, marginBottom: 16, fontSize: 12, lineHeight: 1.65 }}>
                This is <strong>not</strong> for pages that already have a <code>sitemap.xml</code>. This is for sites where the sitemap is just a regular HTML page listing links — a <strong>visual site map</strong> made for people to browse, not for machines to parse. It might be at <code>/site-map/</code>, <code>/sitemap/</code>, <code>/pages/</code>, or just a big list of links on any page. Paste that URL below.
              </p>

              <label className="field-label">HTML page URL</label>
              <div className="input-row">
                <input
                  className="text-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/site-map/"
                  required
                />
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? "Working…" : "Fetch & Convert"}
                </button>
              </div>
              <p className="hint">
                The converter fetches the page, finds every <code>&lt;a href&gt;</code> link on it that points to the same website, and turns them into a proper <code>sitemap.xml</code> you can upload to the ACE scanner. Redirects are followed automatically (<code>example.com</code> and <code>www.example.com</code> are treated as the same site).
              </p>

              <div className="btn-row" style={{ marginTop: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
                  <label
                    className="field-label"
                    style={{ marginBottom: 0, marginRight: 10 }}
                  >
                    Timeout
                  </label>
                  <div className="input-row" style={{ maxWidth: 140 }}>
                    <input
                      className="number-input"
                      type="number"
                      min={1}
                      max={120}
                      value={timeoutValue}
                      onChange={(e) =>
                        setTimeoutValue(parseInt(e.target.value, 10) || 30)
                      }
                    />
                    <span
                      style={{
                        padding: "14px 8px 14px 0",
                        color: "var(--ink-faint)",
                        fontSize: 11,
                      }}
                    >
                      sec
                    </span>
                  </div>
                </div>
              </div>

              {liveVisible && (
                <div className={`status ${statusKind}`}>
                  <div className="status-row">
                    <span>
                      {statusKind === "loading" && <span className="ticker" />}
                      {errorMsg ? `✕ ${errorMsg}` : stageMsg || "Working…"}
                    </span>
                    <span className="meta">
                      {bytes > 0 && `${formatBytes(bytes)}`}
                      {pct !== null && ` · ${pct}%`}
                      {links.length > 0 &&
                        ` · ${links.length} link${links.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  {submitting && (
                    <div className={`progress-bar ${pct === null ? "indet" : ""}`}>
                      <div
                        className="fill"
                        style={{ width: pct !== null ? `${pct}%` : undefined }}
                      />
                    </div>
                  )}
                  {progressLog.length > 0 && (
                    <div ref={logRef} className="log">
                      {progressLog.map((line, i) => (
                        <div key={i} className="log-line">
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </section>

        {/* SECTION 2 — MANIFEST */}
        {(links.length > 0 || finished) && (
          <section className="card" ref={manifestRef}>
            <div className="card-head">
              <span className="card-num">2</span>
              <span className="card-eyebrow">Section 2</span>
            </div>
            <h2 className="card-title">The Manifest</h2>

            <div className="card-body">
              <div className="stats-grid">
                <div className="stat">
                  <span className="stat-label">Links found</span>
                  <span className="stat-value accent">{paddedCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Domain</span>
                  <span className="stat-value sm">{domain}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Issued</span>
                  <span className="stat-value sm">{issued}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Format</span>
                  <span className="stat-value sm">UTF-8 · sorted · unique</span>
                </div>
              </div>

              <div className="actions-bar">
                <input
                  className="filter-input"
                  type="text"
                  placeholder="Filter the manifest…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <button className="btn ghost" type="button" onClick={handleCopy}>
                  ⧉ Copy All
                </button>
                <button className="btn" type="button" onClick={() => handleDownload("txt")}>
                  ↓ .txt
                </button>
                <button
                  className="btn accent"
                  type="button"
                  onClick={() => handleDownload("xml")}
                >
                  ↓ sitemap.xml
                </button>
              </div>

              <div className="index">
                {filteredLinks.map(({ href, i, visible }) => (
                  <div key={href} className={`row ${visible ? "" : "hidden"}`}>
                    <span className="num">{String(i + 1).padStart(3, "0")}</span>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {shortPath(href)}{" "}
                      <span className="path">· {href.replace(/^https?:\/\//, "")}</span>
                    </a>
                    <span className="ext">open ↗</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3 — HANDOFF */}
        {finished && links.length > 0 && (
          <section className="card handoff" ref={handoffRef}>
            <div className="card-head">
              <span className="card-num">3</span>
              <span className="card-eyebrow">Section 3 · Handoff</span>
              <div className="card-head-right">
                <span className="pill ok" style={{ background: "var(--green)", color: "var(--ink)" }}>
                  Ready
                </span>
              </div>
            </div>
            <h2 className="card-title">Send to ACE Classifier</h2>

            <div className="card-body">
              <p className="hint" style={{ fontSize: 12, marginBottom: 18, lineHeight: 1.65 }}>
                Now that the links have been extracted from the HTML page, you can send them straight to the{" "}
                <strong>AccessibilityChecker.org scanner</strong> for a full accessibility audit. Clicking below opens the scanner and automatically loads all <strong>{links.length}</strong> URLs — no copy-pasting needed.
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSendToClassifier}
                >
                  ↗ Send to ACE Classifier
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleDownload("xml")}
                >
                  ↓ Or download sitemap.xml
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="colophon">
          <div>
            <h4>What this is for</h4>
            <p>Websites that don&apos;t have a machine-readable sitemap.xml — only an HTML page listing their pages for humans.</p>
            <p>This tool reads that page and converts it into a proper sitemap.xml the ACE scanner can process.</p>
          </div>
          <div>
            <h4>What this is NOT for</h4>
            <p>Sites that already have /sitemap.xml — the ACE scanner can read those directly. No conversion needed.</p>
          </div>
          <div>
            <h4>Links</h4>
            <p>
              Scanner ·{" "}
              <a href={CLASSIFIER_URL} target="_blank" rel="noopener noreferrer">
                ACE Sitemap Scanner
              </a>
            </p>
            <p>
              Source ·{" "}
              <a
                href="https://github.com/AccessibilityChecker-org/sitemap-converter"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </p>
          </div>
        </footer>
      </main>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}
