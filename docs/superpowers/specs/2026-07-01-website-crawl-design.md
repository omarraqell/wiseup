# Live Website Crawl (`browse_wiseup_website`) — Design Spec

**Date:** 2026-07-01
**Project:** WISEUP Catalog Assistant (agentic RAG on LangGraph)
**Branch:** `feature/website-crawl`
**Status:** Approved design → ready for implementation plan

## 1. Goal

Let the agent **look at products live on wiseuptools.com** when the local catalog can't answer.
Replace the broken `search_wiseup_web` (Tavily *search*, empty index, crashes) with
`browse_wiseup_website(query)` — a Tavily **crawl**-backed tool that crawls the site's products
area, extracts best-effort structured product records **with images**, and returns them as
**cards + a short text summary** (the agent frames the cards).

The agentic graph, lead flow, and hybrid retrieval are unchanged. This changes `tools.py`
(replace the web tool + crash fix), `agent_graph.py` (prompt scope), and a small
`frontend/index.html` tweak for web-cards.

## 2. Current problems being fixed

1. `_format_tavily` crashes on Tavily's plain-string "no results" return (`'str' object has no
   attribute 'get'`), swallowed by `handle_tool_errors`.
2. `search_wiseup_web` uses Tavily *search* against an index with nothing for wiseuptools.com — no
   data ever.
3. The tool is mis-scoped: the agent fires it for product questions the catalog answers better.

## 3. The tool: `browse_wiseup_website(query, tool_call_id)`

`@tool` returning a `Command` (mirrors `retrieve_products`), signature uses
`Annotated[str, InjectedToolCallId]`.

**Crawl step** (`langchain_tavily.TavilyCrawl`, uses existing `TAVILY_API_KEY`, via a lazy
`_get_crawler()` singleton so importing `tools` needs no key and tests can monkeypatch it):
```python
res = _get_crawler().invoke({
    "url": SITE_URL,               # products category page (§7)
    "instructions": query,         # natural-language steer
    "include_images": True,
    "extract_depth": "advanced",
    "format": "markdown",
    "max_depth": 1,                # keep it shallow (latency/credits)
    "limit": 10,
})
```

**Extraction step** — `_extract_web_products(res, query) -> list[dict]`:
- Pull the crawled page text + image URLs out of `res` (handle dict/list/str shapes; reuse the
  hardened `_format_tavily` for the text).
- Call a small LLM (`gpt-4o-mini`, created via an injectable `_web_llm()` helper so tests can
  monkeypatch it) with a strict instruction to return a **JSON array** of
  `{name, price, image_url, source_url}` (price may be null; image_url absolute). Parse with
  `json.loads`; on any parse/LLM failure return `[]`.

**Card step** — `to_web_card(rec, relevance) -> dict`:
```python
{"code": "", "name_ar": rec.get("name", ""), "price_jod": rec.get("price"),  # None if absent
 "unit": "", "image_url": rec.get("image_url", ""), "source_url": rec.get("source_url", ""),
 "relevance": int(relevance)}
```
Relevance is rank-based via the existing `tools._rank_relevance(i, n)`.

**Return:**
- If cards were produced: `Command(update={"retrieved_products": cards, "messages":[ToolMessage(summary, tool_call_id=...)]})` where `summary` is the crawled-text digest (so the agent writes a short intro pointing at the cards).
- If nothing usable (empty crawl, no results, extraction `[]`, or an exception): return
  `Command(update={"messages":[ToolMessage("I couldn't find that on the WISEUP website.", tool_call_id=...)]})` — **no `retrieved_products` key**, so existing cards aren't wiped.

## 4. `_format_tavily` crash fix

Handle the string case explicitly:
```python
def _format_tavily(res) -> str:
    if isinstance(res, str):
        return res.strip() or "No results found on the WISEUP website."
    items = res.get("results", []) if isinstance(res, dict) else (res or [])
    if not items:
        return "No results found on the WISEUP website."
    ...  # unchanged list formatting
```

## 5. Prompt scope (`agent_graph.py` SYSTEM_PROMPT)

- Update the tool list: `search_wiseup_web` → `browse_wiseup_website` — "crawl the live WISEUP
  website for products/info NOT in the local catalog, or when the customer explicitly asks about
  the website."
- Add the rule: **always try `retrieve_products` (local catalog, instant, has JOD prices) first;
  only call `browse_wiseup_website` when the catalog returns nothing relevant or the customer asks
  about the live site.** Web-card prices may be missing; the catalog is the source of truth for
  pricing.

## 6. Frontend (`frontend/index.html` `card()`)

Images already render (`<img src="${p.image_url}">` works for absolute URLs — no change). Two
small guards for web-cards:
- **Price:** render the price line only when present — `${p.price_jod != null ? p.price_jod + ' JOD' : ''}` (avoids "undefined JOD").
- **Code / source:** the `كود: ${p.code}` line becomes: show `كود: <code>` when `p.code` is
  non-empty; else if `p.source_url` is present, show a "View on site" (`عرض على الموقع`) link to
  `source_url`; else render nothing.

Catalog cards (with `code`, `price_jod`) render exactly as today.

## 7. Config

- `SITE_URL` constant in `tools.py`, env-overridable `WISEUP_SITE_URL`, default the products
  category page `https://www.wiseuptools.com/h-pr--0_415_19.html`.
- Reuses `TAVILY_API_KEY` (crawl) and OpenAI (extraction). No new keys.

## 8. Error handling

- Tavily string / empty → graceful (§4), tool returns the friendly "couldn't find" `ToolMessage`.
- Crawl exception or extraction failure → caught inside the tool → friendly `ToolMessage`, no card
  wipe. `handle_tool_errors=True` remains the outer safety net.

## 9. Testing (all network-free)

- `_format_tavily` — dict with results, empty dict, list, and **plain string** inputs.
- `_extract_web_products` — monkeypatch `_web_llm` to return a fixed JSON string; assert records
  parsed; malformed JSON → `[]`.
- `to_web_card` — absolute `image_url` passthrough; missing price → `price_jod is None`; maps
  `name`→`name_ar`, keeps `source_url`, `code == ""`.
- `browse_wiseup_website` — monkeypatch `TavilyCrawl` (via an injectable `_get_crawler`) and
  `_extract_web_products`; assert a `Command` with `retrieved_products` web-cards + a
  `ToolMessage`; and the no-results path returns a `ToolMessage` with **no** `retrieved_products`
  key.
- `test_system_prompt` — prompt names `browse_wiseup_website` and the catalog-first rule; no longer
  names `search_wiseup_web`.
- `TOOLS` list contains `browse_wiseup_website` and not `search_wiseup_web`.

## 10. Out of scope (YAGNI)

- Caching crawl results; crawling beyond the seed category (`max_depth: 1`, `limit: 10`).
- Ingesting crawled products into the local Chroma/BM25 index (a separate, larger feature).
- Firecrawl / structured-extraction API (revisit only if Tavily's image↔product mapping proves too
  unreliable in live testing).
- `TavilyExtract`/`TavilyMap` helpers.

## 11. Acceptance criteria

1. Asking for something the catalog lacks (or explicitly "check the website") makes the agent call
   `browse_wiseup_website`; it returns product **cards with images** from wiseuptools.com plus a
   short text intro.
2. A product question the catalog can answer does **not** trigger a crawl (catalog-first).
3. Web-cards render: image, name, a **source link**, and a price **only when present** (no
   "undefined JOD"); catalog cards are unchanged.
4. No crash on empty/string Tavily responses; a no-results crawl yields a friendly message and
   does not wipe existing cards.
5. `python -m pytest -q` is green, with no network calls in tests.
