"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ServerEvent =
  | { type: "stage"; msg: string }
  | { type: "bytes"; n: number }
  | { type: "meta"; finalUrl: string; contentType: string; totalBytes: number | null }
  | { type: "link"; href: string; index: number }
  | { type: "done"; count: number; url: string; links: string[] }
  | { type: "error"; error: string };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

export default function Page() {
  const [url, setUrl] = useState("");
  const [timeout, setTimeoutValue] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [domain, setDomain] = useState("—");
  const [issued, setIssued] = useState("—");
  const [finalCount, setFinalCount] = useState(0);
  const [animatedCount, setAnimatedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [dateline, setDateline] = useState("— · —");

  // Live progress state
  const [stageMsg, setStageMsg] = useState<string>("");
  const [bytes, setBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const manifestRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const now = new Date();
    setDateline(
      `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
    );
  }, []);

  // Animate final count once conversion finishes
  useEffect(() => {
    if (!finished || finalCount === 0) {
      setAnimatedCount(finalCount);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimatedCount(Math.round(finalCount * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [finished, finalCount]);

  // Auto-scroll progress log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progressLog, links.length, bytes]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
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
    setAnimatedCount(0);
    setFinished(false);
    setErrorMsg(null);
    setStageMsg("");
    setBytes(0);
    setTotalBytes(null);
    setProgressLog([]);
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
        body: JSON.stringify({ url: trimmed, timeout }),
      });

      if (!res.body) {
        throw new Error("No response body from server.");
      }

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
          let evt: ServerEvent;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          handleEvent(evt, collected);
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
        break;
      case "link":
        collected.push(evt.href);
        // Flush in small batches to keep React responsive
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
        setTimeout(() => {
          manifestRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
        break;
      }
      case "error":
        setErrorMsg(evt.error);
        appendLog(`✕ ${evt.error}`);
        setStageMsg("Failed.");
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

  const paddedCount = String(finished ? animatedCount : links.length).padStart(
    3,
    "0"
  );

  // Percentage if we know content-length
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

  return (
    <div className="frame">
      <header className="masthead">
        <div className="left">Vol. I &nbsp;·&nbsp; No. 042</div>
        <div className="center">
          The&nbsp;<em>Cartographer</em>
          <sup>{dateline}</sup>
        </div>
        <div className="right">A field manual for sitemaps</div>
      </header>

      <section className="hero">
        <div className="reveal d1">
          <div className="kicker">A utility, no. 01 — extraction</div>
          <h1 className="headline">
            Every link,
            <br />
            <em>uncovered</em> <span className="ampers">&amp;</span>
            <br />
            set in <em>order</em>.
            <span className="small-cap">Sitemap → plain-text manifest</span>
          </h1>
        </div>

        <aside className="lede-block reveal d2">
          <p className="lede">
            Hand this instrument any <strong>visual sitemap page</strong> — a WordPress
            index, a docs hub, a humble table of contents — and it returns a clean, sorted
            ledger of every internal address it can find. <em>One per line. No theatrics.</em>
          </p>
          <ul className="meta-list">
            <li><span>Method</span><span>HTTP · streamed</span></li>
            <li><span>Filtering</span><span>Same-domain only</span></li>
            <li><span>Output</span><span>.txt · sorted · unique</span></li>
            <li><span>Hosted</span><span>Vercel</span></li>
          </ul>
        </aside>
      </section>

      <div className="sec-head reveal d3">
        <div className="sec-num">§ 01</div>
        <h2 className="sec-title">Specimen submission</h2>
        <div className="sec-tag">Provide one (1) URL</div>
      </div>

      <section className="form-wrap">
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field-grid">
            <div className="field">
              <div className="field-label">
                <span>Sitemap address</span>
                <span className="req">▸ required</span>
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/sitemap/"
                required
              />
            </div>
            <div className="field">
              <div className="field-label">
                <span>Timeout</span>
                <span>seconds</span>
              </div>
              <input
                type="number"
                min={1}
                max={120}
                value={timeout}
                onChange={(e) =>
                  setTimeoutValue(parseInt(e.target.value, 10) || 30)
                }
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={submitting}>
              <span>{submitting ? "In progress…" : "Begin extraction"}</span>
            </button>

            <div className="examples">
              {[
                "https://www.wmh.org/site-map/",
                "https://wordpress.org/sitemap/",
                "https://flask.palletsprojects.com/",
              ].map((u) => (
                <button
                  key={u}
                  type="button"
                  className="chip"
                  onClick={() => setUrl(u)}
                >
                  {u.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </button>
              ))}
            </div>
          </div>

          {liveVisible && (
            <div className={`status show ${statusKind}`}>
              {statusKind === "loading" && <span className="ticker" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span>
                    {errorMsg
                      ? `✕ ${errorMsg}`
                      : stageMsg || "Working…"}
                  </span>
                  <span style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                    {bytes > 0 && `${formatBytes(bytes)}`}
                    {pct !== null && ` · ${pct}%`}
                    {links.length > 0 && ` · ${links.length} link${links.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {submitting && (
                  <div
                    style={{
                      marginTop: 10,
                      height: 3,
                      background: "var(--hairline)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {pct !== null ? (
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "var(--vermilion)",
                          transition: "width .2s ease",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: "30%",
                          background: "var(--vermilion)",
                          animation: "slide 1.2s ease-in-out infinite",
                        }}
                      />
                    )}
                  </div>
                )}

                {progressLog.length > 0 && (
                  <div
                    ref={logRef}
                    style={{
                      marginTop: 12,
                      maxHeight: 120,
                      overflowY: "auto",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: "var(--ink-soft)",
                      borderTop: "1px dotted var(--hairline)",
                      paddingTop: 8,
                    }}
                  >
                    {progressLog.map((line, i) => (
                      <div
                        key={i}
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </section>

      <section
        ref={manifestRef}
        className={`manifest ${links.length ? "show" : ""}`}
      >
        <div className="sec-head" style={{ marginTop: 32 }}>
          <div className="sec-num">§ 02</div>
          <h2 className="sec-title">The manifest</h2>
          <div className="sec-tag">
            {submitting ? "Streaming in…" : "Sorted alphabetically"}
          </div>
        </div>

        <div className="manifest-meta">
          <div className="stat">
            <span className="stat-label">Links found</span>
            <span className="stat-value accent">{paddedCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Domain</span>
            <span className="stat-value ital">{domain}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Issued</span>
            <span className="stat-value ital">{issued}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Format</span>
            <span className="stat-value ital">UTF-8 · text/plain</span>
          </div>
        </div>

        <div className="actions-bar">
          <input
            type="text"
            className="filter-input"
            placeholder="Filter the manifest…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="ghost-btn" type="button" onClick={handleCopy}>
            ⧉ Copy all
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => handleDownload("txt")}
          >
            ↓ .txt
          </button>
          <button
            className="ghost-btn accent"
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
                {shortPath(href)}
                <span className="path"> · {href.replace(/^https?:\/\//, "")}</span>
              </a>
              <span className="ext">open ↗</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="colophon">
        <div>
          <h4>Colophon</h4>
          <p>
            Set in <em>Fraunces</em> (display & body) and <em>JetBrains Mono</em> (data).
            Served from the Vercel edge on a paper-stock of #f1ede4.
          </p>
        </div>
        <div>
          <h4>Method</h4>
          <p>
            Next.js · React · cheerio. A streaming GET reports byte progress, then each
            anchor is resolved against the final (post-redirect) base URL and emitted live.
          </p>
        </div>
        <div>
          <h4>Provenance</h4>
          <p>
            Built openly. The source lives at{" "}
            <a
              href="https://github.com/AccessibilityChecker-org/sitemap-converter"
              target="_blank"
              rel="noopener noreferrer"
            >
              github · sitemap-converter
            </a>
            .
          </p>
        </div>
      </footer>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>

      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
