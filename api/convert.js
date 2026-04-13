function extractLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const links = new Set();
  const hrefPattern = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;

  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = (match[1] || match[2] || match[3] || "").trim();
    if (!href) continue;

    const lower = href.toLowerCase();
    if (lower.startsWith("#")) {
      continue;
    }

    let resolved;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }

    if (!(resolved.protocol === "http:" || resolved.protocol === "https:")) {
      continue;
    }

    if (resolved.host !== base.host) {
      continue;
    }

    resolved.hash = "";
    links.add(resolved.toString());
  }

  return Array.from(links).sort((a, b) => a.localeCompare(b));
}

async function convertUrl(url, timeoutSeconds = 30) {
  const controller = new AbortController();
  const timeoutMs = timeoutSeconds * 1000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "SitemapConverterWeb/1.0" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const html = await response.text();
    const links = extractLinks(html, url);
    const txt = links.join("\n") + (links.length ? "\n" : "");
    return { links, txt };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const url = (body.url || "").trim();
  const timeout = parseInt(body.timeout || "30", 10);

  if (!url) {
    return res.status(400).json({ error: "Please provide a sitemap URL." });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Please provide a valid URL." });
  }

  if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
    return res.status(400).json({ error: "URL must use http or https." });
  }

  if (Number.isNaN(timeout) || !Number.isInteger(timeout) || timeout <= 0 || timeout > 120) {
    return res
      .status(400)
      .json({ error: "Timeout must be a positive integer between 1 and 120." });
  }

  try {
    const result = await convertUrl(parsed.toString(), timeout);
    return res.status(200).json(result);
  } catch (error) {
    const message =
      error && error.name === "AbortError"
        ? "Request timed out while fetching the sitemap page."
        : error instanceof Error
          ? error.message
          : "Unexpected conversion error.";
    return res.status(502).json({ error: message });
  }
}
