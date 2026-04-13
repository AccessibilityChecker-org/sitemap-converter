import * as cheerio from "cheerio";

export const runtime = "nodejs";

type Event =
  | { type: "stage"; msg: string }
  | { type: "bytes"; n: number }
  | { type: "meta"; finalUrl: string; contentType: string; totalBytes: number | null }
  | { type: "link"; href: string; index: number }
  | { type: "done"; count: number; url: string; links: string[] }
  | { type: "error"; error: string };

const normalizeHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({} as any));
  let url = (data?.url || "").toString().trim();
  const timeoutRaw = data?.timeout ?? 30;

  const encoder = new TextEncoder();

  const makeStream = (run: (emit: (e: Event) => void) => Promise<void>) =>
    new ReadableStream({
      async start(controller) {
        const emit = (e: Event) => {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        };
        try {
          await run(emit);
        } catch (err: any) {
          emit({ type: "error", error: err?.message || String(err) });
        } finally {
          controller.close();
        }
      },
    });

  // Validation first — return a single-event stream with the error so the
  // client can always consume NDJSON uniformly.
  if (!url) {
    return new Response(
      makeStream(async (emit) =>
        emit({ type: "error", error: "Please enter a sitemap URL." })
      ),
      { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const timeout = Number(timeoutRaw);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120) {
    return new Response(
      makeStream(async (emit) =>
        emit({
          type: "error",
          error: "Timeout must be an integer between 1 and 120.",
        })
      ),
      { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const stream = makeStream(async (emit) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout * 1000);

    try {
      emit({ type: "stage", msg: `Resolving ${url}` });
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SitemapConverter/1.0)",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!res.ok) {
        emit({ type: "error", error: `Fetch failed: HTTP ${res.status}` });
        return;
      }

      const finalUrl = res.url || url;
      const contentType = res.headers.get("content-type") || "unknown";
      const totalHeader = res.headers.get("content-length");
      const totalBytes = totalHeader ? parseInt(totalHeader, 10) : null;

      emit({ type: "meta", finalUrl, contentType, totalBytes });
      emit({
        type: "stage",
        msg:
          finalUrl !== url
            ? `Redirected → ${finalUrl}. Downloading…`
            : `Connected. Downloading…`,
      });

      // Stream the body so we can report byte progress.
      const reader = res.body?.getReader();
      let html = "";
      if (reader) {
        const decoder = new TextDecoder("utf-8", { fatal: false });
        let received = 0;
        let lastEmit = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            received += value.byteLength;
            html += decoder.decode(value, { stream: true });
            // Throttle byte events (every ~16 KB)
            if (received - lastEmit > 16 * 1024) {
              emit({ type: "bytes", n: received });
              lastEmit = received;
            }
          }
        }
        html += decoder.decode();
        emit({ type: "bytes", n: received });
      } else {
        html = await res.text();
      }

      emit({ type: "stage", msg: "Parsing HTML…" });

      const $ = cheerio.load(html);
      const base = new URL(finalUrl);
      const baseHost = normalizeHost(base.hostname);
      const seen = new Set<string>();
      const anchors = $("a[href]").toArray();

      emit({
        type: "stage",
        msg: `Scanning ${anchors.length} anchor${anchors.length === 1 ? "" : "s"}…`,
      });

      let index = 0;
      for (const el of anchors) {
        const raw = ($(el).attr("href") || "").trim();
        if (!raw) continue;
        if (/^(#|javascript:|mailto:|tel:)/i.test(raw)) continue;

        let abs: URL;
        try {
          abs = new URL(raw, base);
        } catch {
          continue;
        }
        if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
        if (normalizeHost(abs.hostname) !== baseHost) continue;

        abs.hash = "";
        const href = abs.toString();
        if (seen.has(href)) continue;
        seen.add(href);

        index += 1;
        emit({ type: "link", href, index });
      }

      const links = [...seen].sort();
      emit({ type: "stage", msg: "Sorting manifest…" });
      emit({ type: "done", count: links.length, url: finalUrl, links });
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? `Request timed out after ${timeout}s`
          : `Could not fetch URL: ${err?.message || err}`;
      emit({ type: "error", error: msg });
    } finally {
      clearTimeout(t);
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
