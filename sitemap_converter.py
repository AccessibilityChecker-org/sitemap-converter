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


def convert_sitemap(url, output_file=None, timeout=30, emit_stdout=True):
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
    elif emit_stdout:
        for link in links:
            print(link)

    return links


def launch_gui(default_url="", default_output="", default_timeout=30):
    """Launch a desktop GUI for sitemap conversion."""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox
    except ImportError:
        print("Tkinter is not available in this Python environment.", file=sys.stderr)
        sys.exit(1)

    root = tk.Tk()
    root.title("Sitemap Converter")
    root.geometry("760x520")

    main_frame = tk.Frame(root, padx=12, pady=12)
    main_frame.pack(fill="both", expand=True)

    tk.Label(main_frame, text="Sitemap URL").grid(
        row=0, column=0, sticky="w", pady=(0, 8)
    )
    url_var = tk.StringVar(value=default_url)
    url_entry = tk.Entry(main_frame, textvariable=url_var, width=80)
    url_entry.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 12))

    tk.Label(main_frame, text="Output file (optional)").grid(
        row=2, column=0, sticky="w", pady=(0, 8)
    )
    output_var = tk.StringVar(value=default_output)
    output_entry = tk.Entry(main_frame, textvariable=output_var, width=65)
    output_entry.grid(row=3, column=0, sticky="ew", pady=(0, 12))

    def browse_output():
        path = filedialog.asksaveasfilename(
            title="Save links as",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
        )
        if path:
            output_var.set(path)

    tk.Button(main_frame, text="Browse…", command=browse_output).grid(
        row=3, column=1, sticky="e", padx=(8, 0), pady=(0, 12)
    )

    tk.Label(main_frame, text="Timeout (seconds)").grid(
        row=4, column=0, sticky="w", pady=(0, 8)
    )
    timeout_var = tk.StringVar(value=str(default_timeout))
    timeout_entry = tk.Entry(main_frame, textvariable=timeout_var, width=15)
    timeout_entry.grid(row=5, column=0, sticky="w", pady=(0, 12))

    status_var = tk.StringVar(value="Ready")
    tk.Label(main_frame, textvariable=status_var, anchor="w").grid(
        row=6, column=0, columnspan=2, sticky="ew", pady=(0, 8)
    )

    results_text = tk.Text(main_frame, wrap="none", height=16)
    results_text.grid(row=8, column=0, columnspan=2, sticky="nsew")

    y_scroll = tk.Scrollbar(main_frame, orient="vertical", command=results_text.yview)
    y_scroll.grid(row=8, column=2, sticky="ns")
    results_text.configure(yscrollcommand=y_scroll.set)

    x_scroll = tk.Scrollbar(main_frame, orient="horizontal", command=results_text.xview)
    x_scroll.grid(row=9, column=0, columnspan=2, sticky="ew")
    results_text.configure(xscrollcommand=x_scroll.set)

    main_frame.columnconfigure(0, weight=1)
    main_frame.rowconfigure(8, weight=1)

    def run_conversion():
        url = url_var.get().strip()
        output_file = output_var.get().strip() or None
        timeout_raw = timeout_var.get().strip()

        if not url:
            messagebox.showerror("Missing URL", "Please provide a sitemap URL.")
            return

        try:
            timeout = int(timeout_raw)
            if timeout <= 0:
                raise ValueError("Timeout must be positive")
        except ValueError:
            messagebox.showerror(
                "Invalid timeout", "Timeout must be a positive integer."
            )
            return

        status_var.set("Converting...")
        root.update_idletasks()

        try:
            links = convert_sitemap(
                url, output_file=output_file, timeout=timeout, emit_stdout=False
            )
        except requests.RequestException as exc:
            status_var.set("Failed")
            messagebox.showerror("Fetch error", f"Error fetching URL:\n{exc}")
            return
        except OSError as exc:
            status_var.set("Failed")
            messagebox.showerror("Write error", f"Error writing output file:\n{exc}")
            return

        results_text.delete("1.0", "end")
        if links:
            results_text.insert("1.0", "\n".join(links))
        status_suffix = f" Saved to '{output_file}'." if output_file else ""
        status_var.set(f"Done: extracted {len(links)} link(s).{status_suffix}")

    tk.Button(main_frame, text="Convert", command=run_conversion).grid(
        row=7, column=0, sticky="w", pady=(0, 8)
    )

    url_entry.focus_set()
    root.mainloop()


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Crawl a WordPress visual sitemap page and convert it to a "
            "plain-text file of links, one per line."
        )
    )
    parser.add_argument(
        "url", nargs="?", help="URL of the WordPress visual sitemap page"
    )
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
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Launch desktop GUI instead of CLI mode",
    )

    args = parser.parse_args()

    if args.gui:
        launch_gui(
            default_url=args.url or "",
            default_output=args.output or "",
            default_timeout=args.timeout,
        )
        return

    if not args.url:
        parser.error("the following arguments are required: url (unless --gui is used)")

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
