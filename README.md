# sitemap-converter

A command-line tool that crawls a WordPress visual sitemap page (HTML or PHP-rendered) and converts it into a plain-text file of links, one URL per line.

Many WordPress sites expose their site structure through a visually styled sitemap page rather than a machine-readable XML sitemap. This tool fetches that page, extracts every internal link, deduplicates and sorts them, and writes the result to a `.txt` file (or prints them to stdout).

## Requirements

- Python 3.8+
- [requests](https://pypi.org/project/requests/)
- [beautifulsoup4](https://pypi.org/project/beautifulsoup4/)
- [lxml](https://pypi.org/project/lxml/)

Install dependencies:

```bash
pip install -r requirements.txt
```

## Usage

```
python sitemap_converter.py [-h] [-o FILE] [--timeout SECONDS] [--gui] [url]
```

### Arguments

| Argument | Description |
|---|---|
| `url` | URL of the WordPress visual sitemap page to crawl (required in CLI mode) |
| `-o FILE`, `--output FILE` | Path of the output `.txt` file (default: print to stdout) |
| `--timeout SECONDS` | HTTP request timeout in seconds (default: `30`) |
| `--gui` | Launch a desktop UI (Tkinter) instead of CLI mode |

### Examples

Print all internal links from a sitemap page to stdout:

```bash
python sitemap_converter.py https://example.com/sitemap
```

Save the links to a file:

```bash
python sitemap_converter.py https://example.com/sitemap -o links.txt
```

Launch the desktop UI:

```bash
python sitemap_converter.py --gui
```

Launch the desktop UI with pre-filled values:

```bash
python sitemap_converter.py --gui https://example.com/sitemap -o links.txt --timeout 20
```

The resulting `links.txt` will contain one URL per line, for example:

```
https://example.com/about
https://example.com/about/team
https://example.com/contact
https://example.com/services
```

## How it works

1. Fetches the given URL with a standard HTTP GET request.
2. Parses the HTML response (including PHP-rendered pages served as HTML) with `BeautifulSoup`.
3. Collects every `<a href="...">` element and resolves relative URLs against the base URL.
4. Filters out external links, `javascript:`, `mailto:`, `tel:`, and bare fragment (`#`) links.
5. Strips URL fragments, deduplicates, and sorts the remaining internal URLs.
6. Writes the final list to the output file (or stdout), one URL per line.

## Running tests

```bash
python -m unittest discover -s tests -v
```
