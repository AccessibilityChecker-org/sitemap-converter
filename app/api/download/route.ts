import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const data = await req.json().catch(() => ({} as any));
  const links = data?.links;
  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No links to download." },
      { status: 400 }
    );
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
