#!/usr/bin/env python3
"""Flask web UI for sitemap-converter.

Run with:  python app.py
Then open: http://127.0.0.1:5000
"""

import io

import requests
from flask import Flask, jsonify, render_template, request, send_file

from sitemap_converter import convert_sitemap

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/convert", methods=["POST"])
def api_convert():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    timeout_raw = data.get("timeout", 30)

    if not url:
        return jsonify({"ok": False, "error": "Please enter a sitemap URL."}), 400

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        timeout = int(timeout_raw)
        if timeout <= 0 or timeout > 120:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify(
            {"ok": False, "error": "Timeout must be an integer between 1 and 120."}
        ), 400

    try:
        links = convert_sitemap(url, output_file=None, timeout=timeout, emit_stdout=False)
    except requests.RequestException as exc:
        return jsonify({"ok": False, "error": f"Could not fetch URL: {exc}"}), 502
    except Exception as exc:  # pragma: no cover - defensive
        return jsonify({"ok": False, "error": f"Unexpected error: {exc}"}), 500

    return jsonify({"ok": True, "url": url, "count": len(links), "links": links})


@app.route("/api/download", methods=["POST"])
def api_download():
    data = request.get_json(silent=True) or {}
    links = data.get("links") or []
    if not isinstance(links, list) or not links:
        return jsonify({"ok": False, "error": "No links to download."}), 400

    buf = io.BytesIO(("\n".join(links) + "\n").encode("utf-8"))
    return send_file(
        buf,
        mimetype="text/plain",
        as_attachment=True,
        download_name="sitemap-links.txt",
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
