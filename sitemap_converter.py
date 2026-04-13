#!/usr/bin/env python3
"""
sitemap-converter: Crawls a WordPress visual sitemap page and converts it
to a plain-text file containing all internal links, one per line.
"""

import argparse
import sys
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


def fetch_page(url, timeout=30):
    """Fetch the HTML content of *url* and return it as a string."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SitemapConverter/1.0)"}
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.text


def extract_links(html, base_url):
    """Return a sorted list of unique internal links found in *html*.

    Only ``http``/``https`` links that belong to the same domain as
    *base_url* are returned.  Fragments, ``javascript:``, ``mailto:``,
    and ``tel:`` pseudo-links are excluded.
    """
    soup = BeautifulSoup(html, "lxml")
    base_domain = urlparse(base_url).netloc
    links = set()

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()

        # Skip empty or non-navigable hrefs
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue

        # Resolve relative URLs against the base URL
        absolute_url = urljoin(base_url, href)
        parsed = urlparse(absolute_url)

        # Keep only same-domain http/https links; strip URL fragments
        if parsed.scheme in ("http", "https") and parsed.netloc == base_domain:
            clean_url = parsed._replace(fragment="").geturl()
            links.add(clean_url)

    return sorted(links)


def convert_sitemap(url, output_file=None, timeout=30):
    """Fetch *url*, extract internal links, and optionally write to *output_file*.

    If *output_file* is ``None`` the links are printed to stdout.
    Returns the list of extracted links.
    """
    html = fetch_page(url, timeout=timeout)
    links = extract_links(html, url)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as fh:
            for link in links:
                fh.write(link + "\n")
    else:
        for link in links:
            print(link)

    return links


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Crawl a WordPress visual sitemap page and convert it to a "
            "plain-text file of links, one per line."
        )
    )
    parser.add_argument("url", help="URL of the WordPress visual sitemap page")
    parser.add_argument(
        "-o",
        "--output",
        metavar="FILE",
        default=None,
        help="Output file path (default: print to stdout)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        metavar="SECONDS",
        help="HTTP request timeout in seconds (default: 30)",
    )

    args = parser.parse_args()

    try:
        links = convert_sitemap(args.url, args.output, args.timeout)
        if args.output:
            print(
                f"Extracted {len(links)} link(s) to '{args.output}'",
                file=sys.stderr,
            )
    except requests.RequestException as exc:
        print(f"Error fetching URL: {exc}", file=sys.stderr)
        sys.exit(1)
    except OSError as exc:
        print(f"Error writing output file: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
