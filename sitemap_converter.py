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
    Set *emit_stdout* to ``False`` to suppress stdout output when not writing
    to a file (useful for GUI integration).
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
    """Launch a polished desktop GUI for sitemap conversion."""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox, ttk
    except ImportError:
        print("Tkinter is not available in this Python environment.", file=sys.stderr)
        sys.exit(1)

    import threading

    # Color palette (modern dark-on-light scheme)
    BG = "#f4f6fb"
    CARD = "#ffffff"
    ACCENT = "#4f46e5"
    ACCENT_HOVER = "#4338ca"
    TEXT = "#111827"
    MUTED = "#6b7280"
    BORDER = "#e5e7eb"
    SUCCESS = "#059669"
    DANGER = "#dc2626"

    root = tk.Tk()
    root.title("Sitemap Converter")
    root.geometry("880x640")
    root.minsize(700, 520)
    root.configure(bg=BG)

    style = ttk.Style(root)
    # 'clam' allows the most styling control across platforms
    try:
        style.theme_use("clam")
    except tk.TclError:
        pass

    style.configure("App.TFrame", background=BG)
    style.configure("Card.TFrame", background=CARD, relief="flat")
    style.configure(
        "Header.TLabel",
        background=BG, foreground=TEXT,
        font=("Segoe UI", 20, "bold"),
    )
    style.configure(
        "Subheader.TLabel",
        background=BG, foreground=MUTED,
        font=("Segoe UI", 10),
    )
    style.configure(
        "Field.TLabel",
        background=CARD, foreground=TEXT,
        font=("Segoe UI", 10, "bold"),
    )
    style.configure(
        "Hint.TLabel",
        background=CARD, foreground=MUTED,
        font=("Segoe UI", 9),
    )
    style.configure(
        "Status.TLabel",
        background=BG, foreground=MUTED,
        font=("Segoe UI", 10),
    )
    style.configure(
        "Count.TLabel",
        background=BG, foreground=ACCENT,
        font=("Segoe UI", 11, "bold"),
    )
    style.configure(
        "Modern.TEntry",
        fieldbackground=CARD, foreground=TEXT,
        bordercolor=BORDER, lightcolor=BORDER, darkcolor=BORDER,
        padding=8,
    )
    style.configure(
        "Primary.TButton",
        background=ACCENT, foreground="#ffffff",
        font=("Segoe UI", 11, "bold"),
        borderwidth=0, padding=(20, 10), focusthickness=0,
    )
    style.map(
        "Primary.TButton",
        background=[("active", ACCENT_HOVER), ("disabled", "#a5b4fc")],
    )
    style.configure(
        "Secondary.TButton",
        background=CARD, foreground=TEXT,
        font=("Segoe UI", 10),
        borderwidth=1, padding=(14, 8), focusthickness=0,
    )
    style.map("Secondary.TButton", background=[("active", BG)])
    style.configure(
        "Modern.Horizontal.TProgressbar",
        background=ACCENT, troughcolor=BORDER,
        borderwidth=0, thickness=4,
    )

    # ---- Header ----
    header = ttk.Frame(root, style="App.TFrame", padding=(24, 20, 24, 8))
    header.pack(fill="x")
    ttk.Label(header, text="Sitemap Converter", style="Header.TLabel").pack(anchor="w")
    ttk.Label(
        header,
        text="Crawl a WordPress visual sitemap and export every internal link.",
        style="Subheader.TLabel",
    ).pack(anchor="w", pady=(2, 0))

    # ---- Input card ----
    card_wrap = ttk.Frame(root, style="App.TFrame", padding=(24, 8, 24, 8))
    card_wrap.pack(fill="x")
    card = tk.Frame(
        card_wrap, bg=CARD, highlightbackground=BORDER,
        highlightthickness=1, bd=0,
    )
    card.pack(fill="x")
    card_inner = tk.Frame(card, bg=CARD, padx=20, pady=18)
    card_inner.pack(fill="x")

    # URL field
    ttk.Label(card_inner, text="Sitemap URL", style="Field.TLabel").grid(
        row=0, column=0, columnspan=3, sticky="w"
    )
    url_var = tk.StringVar(value=default_url)
    url_entry = ttk.Entry(
        card_inner, textvariable=url_var, style="Modern.TEntry",
        font=("Segoe UI", 10),
    )
    url_entry.grid(row=1, column=0, columnspan=3, sticky="ew", pady=(6, 4))
    ttk.Label(
        card_inner,
        text="e.g. https://example.com/sitemap/",
        style="Hint.TLabel",
    ).grid(row=2, column=0, columnspan=3, sticky="w", pady=(0, 14))

    # Output file
    ttk.Label(card_inner, text="Output file (optional)", style="Field.TLabel").grid(
        row=3, column=0, columnspan=3, sticky="w"
    )
    output_var = tk.StringVar(value=default_output)
    output_entry = ttk.Entry(
        card_inner, textvariable=output_var, style="Modern.TEntry",
        font=("Segoe UI", 10),
    )
    output_entry.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(6, 4))

    def browse_output():
        path = filedialog.asksaveasfilename(
            title="Save links as",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
        )
        if path:
            output_var.set(path)

    ttk.Button(
        card_inner, text="Browse…", style="Secondary.TButton",
        command=browse_output,
    ).grid(row=4, column=2, sticky="e", padx=(8, 0), pady=(6, 4))
    ttk.Label(
        card_inner,
        text="Leave blank to view results in the panel below only.",
        style="Hint.TLabel",
    ).grid(row=5, column=0, columnspan=3, sticky="w", pady=(0, 14))

    # Timeout + Convert button row
    ttk.Label(card_inner, text="Timeout (seconds)", style="Field.TLabel").grid(
        row=6, column=0, sticky="w"
    )
    timeout_var = tk.StringVar(value=str(default_timeout))
    timeout_entry = ttk.Entry(
        card_inner, textvariable=timeout_var, style="Modern.TEntry",
        font=("Segoe UI", 10), width=10,
    )
    timeout_entry.grid(row=7, column=0, sticky="w", pady=(6, 0))

    convert_btn = ttk.Button(card_inner, text="Convert", style="Primary.TButton")
    convert_btn.grid(row=7, column=2, sticky="e", pady=(6, 0))

    card_inner.columnconfigure(0, weight=1)
    card_inner.columnconfigure(1, weight=1)

    # ---- Status bar / progress ----
    status_wrap = ttk.Frame(root, style="App.TFrame", padding=(24, 12, 24, 4))
    status_wrap.pack(fill="x")
    status_var = tk.StringVar(value="Ready")
    count_var = tk.StringVar(value="")
    ttk.Label(status_wrap, textvariable=status_var, style="Status.TLabel").pack(
        side="left"
    )
    ttk.Label(status_wrap, textvariable=count_var, style="Count.TLabel").pack(
        side="right"
    )

    progress = ttk.Progressbar(
        root, mode="indeterminate", style="Modern.Horizontal.TProgressbar",
    )
    progress.pack(fill="x", padx=24, pady=(0, 8))

    # ---- Results panel ----
    results_wrap = ttk.Frame(root, style="App.TFrame", padding=(24, 4, 24, 24))
    results_wrap.pack(fill="both", expand=True)
    results_card = tk.Frame(
        results_wrap, bg=CARD, highlightbackground=BORDER,
        highlightthickness=1, bd=0,
    )
    results_card.pack(fill="both", expand=True)

    results_header = tk.Frame(results_card, bg=CARD)
    results_header.pack(fill="x", padx=16, pady=(12, 6))
    tk.Label(
        results_header, text="Extracted links", bg=CARD, fg=TEXT,
        font=("Segoe UI", 11, "bold"),
    ).pack(side="left")

    def copy_results():
        text = results_text.get("1.0", "end").strip()
        if not text:
            return
        root.clipboard_clear()
        root.clipboard_append(text)
        status_var.set("Copied results to clipboard.")

    def clear_results():
        results_text.configure(state="normal")
        results_text.delete("1.0", "end")
        count_var.set("")
        status_var.set("Cleared.")

    ttk.Button(
        results_header, text="Clear", style="Secondary.TButton",
        command=clear_results,
    ).pack(side="right", padx=(6, 0))
    ttk.Button(
        results_header, text="Copy", style="Secondary.TButton",
        command=copy_results,
    ).pack(side="right")

    text_frame = tk.Frame(results_card, bg=CARD)
    text_frame.pack(fill="both", expand=True, padx=16, pady=(0, 16))

    results_text = tk.Text(
        text_frame, wrap="none", bd=0, relief="flat",
        bg="#fafbfc", fg=TEXT, insertbackground=TEXT,
        font=("Consolas", 10), padx=12, pady=10,
        highlightthickness=1, highlightbackground=BORDER,
    )
    results_text.grid(row=0, column=0, sticky="nsew")
    y_scroll = ttk.Scrollbar(text_frame, orient="vertical", command=results_text.yview)
    y_scroll.grid(row=0, column=1, sticky="ns")
    x_scroll = ttk.Scrollbar(text_frame, orient="horizontal", command=results_text.xview)
    x_scroll.grid(row=1, column=0, sticky="ew")
    results_text.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)
    text_frame.rowconfigure(0, weight=1)
    text_frame.columnconfigure(0, weight=1)

    # ---- Conversion logic (threaded so UI stays responsive) ----
    def set_busy(busy):
        if busy:
            convert_btn.state(["disabled"])
            progress.start(12)
        else:
            convert_btn.state(["!disabled"])
            progress.stop()

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
                raise ValueError
        except ValueError:
            messagebox.showerror(
                "Invalid timeout", "Timeout must be a positive integer."
            )
            return

        status_var.set("Fetching sitemap…")
        count_var.set("")
        set_busy(True)

        def worker():
            try:
                links = convert_sitemap(
                    url, output_file=output_file,
                    timeout=timeout, emit_stdout=False,
                )
            except requests.RequestException as exc:
                root.after(0, lambda: _on_error("Fetch error", str(exc)))
                return
            except OSError as exc:
                root.after(0, lambda: _on_error("Write error", str(exc)))
                return
            root.after(0, lambda: _on_success(links, output_file))

        def _on_success(links, output_file):
            set_busy(False)
            results_text.configure(state="normal")
            results_text.delete("1.0", "end")
            if links:
                results_text.insert("1.0", "\n".join(links))
            count_var.set(f"{len(links)} link{'s' if len(links) != 1 else ''}")
            suffix = f"  ·  Saved to {output_file}" if output_file else ""
            status_var.set(f"Done.{suffix}")

        def _on_error(title, msg):
            set_busy(False)
            status_var.set(f"Failed: {title.lower()}")
            count_var.set("")
            messagebox.showerror(title, msg)

        threading.Thread(target=worker, daemon=True).start()

    convert_btn.configure(command=run_conversion)
    root.bind("<Return>", lambda _e: run_conversion())

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
        parser.error("the following arguments are required: url")

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
