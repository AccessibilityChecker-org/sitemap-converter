# sitemap-converter

A tool that crawls a WordPress visual sitemap page (HTML or PHP-rendered) and converts it into a plain-text file of links, one URL per line.

It now includes:
- A **CLI** mode (Python)
- A **desktop GUI** mode (Tkinter)
- A **web UI** built with **React.js** for Vercel deployment

This is useful when a site does not expose a standard XML sitemap and you need a TXT file with one URL per line for the AccessibilityChecker.org dashboard scanner.

## Requirements

### Python modes (CLI + Tkinter GUI)
- Python 3.8+
- [requests](https://pypi.org/project/requests/)
- [beautifulsoup4](https://pypi.org/project/beautifulsoup4/)
- [lxml](https://pypi.org/project/lxml/)

Install Python dependencies:

```bash
pip install -r requirements.txt
```

## CLI usage

```bash
python sitemap_converter.py [-h] [-o FILE] [--timeout SECONDS] [--gui] [url]
```

### Arguments

| Argument | Description |
|---|---|
| `url` | URL of the WordPress visual sitemap page to crawl (required in CLI mode) |
| `-o FILE`, `--output FILE` | Path of the output `.txt` file (default: print to stdout) |
| `--timeout SECONDS` | HTTP request timeout in seconds (default: `30`) |
| `--gui` | Launch a desktop UI (Tkinter) instead of CLI mode |

### CLI examples

Print all internal links from a sitemap page to stdout:

```bash
python sitemap_converter.py https://example.com/sitemap
```

Save the links to a file:

```bash
python sitemap_converter.py https://example.com/sitemap -o links.txt
```

Launch desktop UI:

```bash
python sitemap_converter.py --gui
```

## React web UI (Vercel-ready)

The web app provides:
- URL input for sitemap page crawling
- One-click conversion
- Live TXT preview (`one URL per line`)
- **Download TXT** button
- Copy-to-clipboard for fast paste into the AccessibilityChecker dashboard scanner

### Run locally

Use Vercel CLI so the API and static frontend run together:

```bash
npx vercel dev
```

Then open `http://localhost:3000`.

### Deploy to Vercel

1. Import this repository in Vercel.
2. Deploy with default settings.
3. Vercel will serve:
   - `index.html` + `app.js` + `styles.css` as the React frontend
   - `api/convert.js` as the serverless conversion endpoint

No extra build step is required.

## Output format

The generated TXT output always contains one URL per line:

```txt
https://example.com/about
https://example.com/about/team
https://example.com/contact
https://example.com/services
```

## How it works

1. Fetches the provided sitemap page URL.
2. Parses anchor tags and resolves relative links against the base URL.
3. Keeps same-domain `http`/`https` links only.
4. Excludes `javascript:`, `mailto:`, `tel:`, and fragment-only links.
5. Removes fragments, deduplicates, sorts, and outputs one URL per line.

## Running tests

```bash
python -m unittest discover -s tests -v
```
