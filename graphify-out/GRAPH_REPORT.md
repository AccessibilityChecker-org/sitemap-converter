# Graph Report - .  (2026-04-13)

## Corpus Check
- Corpus is ~4,820 words - fits in a single context window. You may not need a graph.

## Summary
- 72 nodes · 80 edges · 12 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `TestExtractLinks` - 14 edges
2. `convert_sitemap()` - 10 edges
3. `extract_links()` - 6 edges
4. `launch_gui()` - 5 edges
5. `handleEvent()` - 5 edges
6. `showToast()` - 4 edges
7. `handleSubmit()` - 4 edges
8. `Next.js POST /api/convert Route (Streaming NDJSON)` - 4 edges
9. `Next.js React Page - The Cartographer UI` - 4 edges
10. `fetch_page()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `README - How It Works (6-step pipeline)` --references--> `convert_sitemap()`  [INFERRED]
  README.md → sitemap_converter.py
- `WMH Hospital Sitemap - Sample Output Data` --shares_data_with--> `convert_sitemap()`  [INFERRED]
  wmh-sitemap.txt → sitemap_converter.py
- `launch_gui()` --semantically_similar_to--> `Next.js React Page - The Cartographer UI`  [INFERRED] [semantically similar]
  sitemap_converter.py → app/page.tsx
- `extract_links()` --semantically_similar_to--> `Next.js POST /api/convert Route (Streaming NDJSON)`  [INFERRED] [semantically similar]
  sitemap_converter.py → app/api/convert/route.ts
- `Flask POST /api/convert Endpoint` --semantically_similar_to--> `Next.js POST /api/convert Route (Streaming NDJSON)`  [INFERRED] [semantically similar]
  app.py → app/api/convert/route.ts

## Hyperedges (group relationships)
- **Python Implementation Stack (CLI + Flask + Tkinter)** — sitemap_converter_convert_sitemap, sitemap_converter_fetch_page, sitemap_converter_extract_links, sitemap_converter_main, sitemap_converter_launch_gui, app_flask_api_convert, app_flask_api_download, app_flask_index [EXTRACTED 0.95]
- **Next.js Implementation Stack (React + API Routes)** — page_nextjs_ui, layout_nextjs, route_nextjs_api_convert, route_nextjs_api_download, route_nextjs_build_xml, concept_streaming_ndjson [EXTRACTED 0.95]
- **Conversion Request Flow (UI -> API -> Parse -> Return Links)** — page_nextjs_ui, route_nextjs_api_convert, concept_same_domain_filtering, concept_streaming_ndjson [INFERRED 0.88]

## Communities

### Community 0 - "Python Flask + CLI Core"
Cohesion: 0.17
Nodes (9): README - How It Works (6-step pipeline), convert_sitemap(), fetch_page(), launch_gui(), main(), Fetch the HTML content of *url* and return it as a string., Fetch *url*, extract internal links, and optionally write to *output_file*., Launch a polished desktop GUI for sitemap conversion. (+1 more)

### Community 1 - "extract_links Tests"
Cohesion: 0.13
Nodes (3): Tests for the extract_links() helper., Simulate a typical WordPress visual sitemap page., TestExtractLinks

### Community 2 - "React UI Handlers"
Cohesion: 0.33
Nodes (8): appendLog(), formatBytes(), handleCopy(), handleDownload(), handleEvent(), handleSubmit(), resetRun(), showToast()

### Community 3 - "Cross-Impl API Endpoints"
Cohesion: 0.2
Nodes (10): Flask POST /api/convert Endpoint, Flask POST /api/download Endpoint, Flask GET / Index Route, Same-Domain Link Filtering Pattern, Next.js React Page - The Cartographer UI, Next.js POST /api/convert Route (Streaming NDJSON), Next.js POST /api/download Route (TXT + XML), buildXml() - Sitemap XML Generator (+2 more)

### Community 4 - "convert_sitemap Tests"
Cohesion: 0.25
Nodes (3): Unit tests for sitemap_converter., Tests for the convert_sitemap() function., TestConvertSitemap

### Community 5 - "Next.js Route Module"
Cohesion: 0.5
Nodes (2): buildXml(), POST()

### Community 6 - "Next.js Layout Module"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "TypeScript Ambient Types"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Tests Package Init"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Root Layout Concept"
Cohesion: 1.0
Nodes (1): Next.js Root Layout

### Community 10 - "README Overview"
Cohesion: 1.0
Nodes (1): README - Tool Description and Usage

### Community 11 - "Streaming NDJSON Pattern"
Cohesion: 1.0
Nodes (1): Streaming NDJSON Response Pattern

## Knowledge Gaps
- **16 isolated node(s):** `Fetch the HTML content of *url* and return it as a string.`, `Return a sorted list of unique internal links found in *html*.      Only ``htt`, `Fetch *url*, extract internal links, and optionally write to *output_file*.`, `Launch a polished desktop GUI for sitemap conversion.`, `Unit tests for sitemap_converter.` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Next.js Layout Module`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Ambient Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tests Package Init`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout Concept`** (1 nodes): `Next.js Root Layout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `README Overview`** (1 nodes): `README - Tool Description and Usage`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Streaming NDJSON Pattern`** (1 nodes): `Streaming NDJSON Response Pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TestExtractLinks` connect `extract_links Tests` to `convert_sitemap Tests`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `convert_sitemap()` connect `Python Flask + CLI Core` to `Cross-Impl API Endpoints`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `launch_gui()` connect `Python Flask + CLI Core` to `Cross-Impl API Endpoints`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `convert_sitemap()` (e.g. with `README - How It Works (6-step pipeline)` and `WMH Hospital Sitemap - Sample Output Data`) actually correct?**
  _`convert_sitemap()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Fetch the HTML content of *url* and return it as a string.`, `Return a sorted list of unique internal links found in *html*.      Only ``htt`, `Fetch *url*, extract internal links, and optionally write to *output_file*.` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `extract_links Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._