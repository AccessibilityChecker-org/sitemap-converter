import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";

function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const set = new Set<string>();

  $("a[href]").each((_, el) => {
    const raw = ($(el).attr("href") || "").trim();
    if (!raw) return;
    if (/^(#|javascript:|mailto:|tel:)/i.test(raw)) return;

    let abs: URL;
    try {
      abs = new URL(raw, base);
    } catch {
      return;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
    if (abs.hostname !== base.hostname) return;

    abs.hash = "";
    set.add(abs.toString());
  });

  return [...set].sort();
}

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({} as any));
  let url = (data?.url || "").toString().trim();
  const timeoutRaw = data?.timeout ?? 30;

  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Please enter a sitemap URL." },
      { status: 400 }
    );
  }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const timeout = Number(timeoutRaw);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120) {
    return NextResponse.json(
      { ok: false, error: "Timeout must be an integer between 1 and 120." },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout * 1000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SitemapConverter/1.0)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Fetch failed: HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const html = await res.text();
    const links = extractLinks(html, url);
    return NextResponse.json({ ok: true, url, count: links.length, links });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? `Request timed out after ${timeout}s`
        : `Could not fetch URL: ${err?.message || err}`;
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
