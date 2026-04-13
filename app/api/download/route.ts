import { NextResponse } from "next/server";

export const runtime = "nodejs";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildXml(links: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = links
    .map(
      (l) =>
        `  <url>\n    <loc>${escapeXml(l)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({} as any));
  const links = data?.links;
  const format = (data?.format || "txt").toString().toLowerCase();

  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No links to download." },
      { status: 400 }
    );
  }

  if (format === "xml") {
    return new NextResponse(buildXml(links), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sitemap.xml"',
      },
    });
  }

  const body = links.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sitemap-links.txt"',
    },
  });
}
