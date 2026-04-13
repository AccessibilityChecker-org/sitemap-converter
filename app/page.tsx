"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ConvertResponse =
  | { ok: true; url: string; count: number; links: string[] }
  | { ok: false; error: string };

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

export default function Page() {
  const [url, setUrl] = useState("");
  const [timeout, setTimeoutValue] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    kind: "loading" | "error" | "success";
    html: string;
  } | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [domain, setDomain] = useState("—");
  const [issued, setIssued] = useState("—");
  const [count, setCount] = useState(0);
  const [animatedCount, setAnimatedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [dateline, setDateline] = useState("— · —");

  const manifestRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const now = new Date();
    setDateline(
      `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
    );
  }, []);

  // Count animation
  useEffect(() => {
    if (count === 0) {
      setAnimatedCount(0);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimatedCount(Math.round(count * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [count]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const filteredLinks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return links.map((href, i) => ({ href, i, visible: true }));
    return links.map((href, i) => ({
      href,
      i,
      visible: href.toLowerCase().includes(q),
    }));
  }, [links, filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setLinks([]);
    setCount(0);
    setStatus({
      kind: "loading",
      html: `<span class="ticker"></span><span>Dispatching request to ${trimmed} …</span>`,
    });

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, timeout }),
      });
      const data = (await res.json()) as ConvertResponse;

      if (!res.ok || !data.ok) {
        const err = "error" in data ? data.error : "The request could not be completed.";
        setStatus({ kind: "error", html: `✕ &nbsp;${err}` });
      } else {
        setLinks(data.links);
        setCount(data.count);
        try {
          setDomain(new URL(data.url).hostname);
        } catch {
          setDomain("—");
        }
        const d = new Date();
        setIssued(
          `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
        );
        setStatus({
          kind: "success",
          html: `✓ &nbsp;Manifest issued. <strong>${data.count}</strong> internal address${data.count === 1 ? "" : "es"} catalogued.`,
        });
        // scroll after DOM updates
        setTimeout(() => {
          manifestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      }
    } catch (err: any) {
      setStatus({ kind: "error", html: `✕ &nbsp;Network error — ${err?.message || err}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!links.length) return;
    await navigator.clipboard.writeText(links.join("\n"));
    showToast(`✓ Copied ${links.length} link${links.length === 1 ? "" : "s"}`);
  };

  const handleDownload = async () => {
    if (!links.length) return;
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sitemap-manifest.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("↓ Manifest downloaded");
  };

  const paddedCount = String(animatedCount).padStart(3, "0");

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
            <li><span>Method</span><span>HTTP · 1 request</span></li>
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
                onChange={(e) => setTimeoutValue(parseInt(e.target.value, 10) || 30)}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={submitting}>
              <span>{submitting ? "In progress…" : "Begin extraction"}</span>
            </button>

            <div className="examples">
              {[
                "https://wmh.org/site-map/",
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

          {status && (
            <div
              className={`status show ${status.kind}`}
              dangerouslySetInnerHTML={{ __html: status.html }}
            />
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
          <div className="sec-tag">Sorted alphabetically</div>
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
            className="ghost-btn accent"
            type="button"
            onClick={handleDownload}
          >
            ↓ Download .txt
          </button>
        </div>

        <div className="index">
          {filteredLinks.map(({ href, i, visible }) => (
            <div
              key={href}
              className={`row ${visible ? "" : "hidden"}`}
            >
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
            Next.js · React · cheerio. A single GET parses the DOM and resolves every
            anchor against the supplied base URL.
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
    </div>
  );
}
