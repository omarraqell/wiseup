# Excel KB Rebuild + Repo Cleanup — Design Spec

**Date:** 2026-06-29
**Project:** WISEUP Catalog Assistant (agentic RAG on LangGraph)
**Branch:** `feature/excel-kb-rebuild`
**Status:** Approved design → ready for implementation plan

## 1. Goal

Replace the entire knowledge base with the client's new Excel price list, rebuild the index
and UI around the new (Arabic, priced) schema, and delete all files unrelated to the agentic
RAG so colleagues see a clean repo.

The agentic graph itself (agent ↔ tools loop, checkpointer, the 3 tools, the lead-capture
email flow) stays — only the **data, ingestion, schema, cards, and prompt** change, plus a
large repo cleanup.

## 2. The new KB

Source: `new products/10_اسعار  الوسب -.xlsx`, one sheet (`Sheet1`), header on row 1:
`الرقم | الصورة | الكود | الصنف | Unit | السعر`. ~542 product rows (rows with a code + name +
price; blank/separator rows are skipped). The `الصورة` column holds **embedded images** (in
`xl/media/`, anchored to rows via `xl/drawings/drawing1.xml`) — 456 pictures.

**Key differences from the old catalog:** Arabic-only names (size baked into the name, e.g.
`6"`); has a **price** (JOD); no series/material/size/packing/weight/CBM columns.

The source file is moved to **`data/wiseup_prices.xlsx`** (clean path); the `new products/`
folder is removed.

## 3. New product schema (`products.json`)

```json
[
  { "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
    "price_jod": 2.5, "image": "images/10101.png" }
]
```
- `code` — string of `الكود`.
- `name_ar` — `الصنف` (Arabic, trimmed).
- `unit` — `Unit` (e.g. `pcs`).
- `price_jod` — `السعر` as a number (JOD).
- `image` — `"images/<code>.png"` if a picture was extracted for that row, else `""`.

## 4. Ingestion (`ingest_excel.py` — new)

One script: `data/wiseup_prices.xlsx` → `products.json` + extracted images.

1. Load with openpyxl (NOT read_only, so images load): `wb = load_workbook("data/wiseup_prices.xlsx")`.
2. Read `Sheet1` rows from row 2. A **product** = row where `الكود` (col C) and `الصنف` (col D)
   and `السعر` (col F) are all non-empty. Build a `row_1based -> code` map as you go.
3. Extract images: iterate `ws._images`. Each image exposes its anchor cell
   `img.anchor._from.row` (0-based) and `._from.col`; convert to 1-based row (`+1`), look up
   the product `code` for that row, and write the bytes (`img._data()`) to
   `images/<code>.png`. If a row has several images, keep the first; rows with no product are
   skipped. (Handle the row-offset so codes and pictures line up — verify against a few known
   rows during implementation.)
4. Write `products.json` (UTF-8, `ensure_ascii=False`), setting `image` to the saved path when
   a picture was extracted for that code, else `""`.

Prints a summary: N products, M images extracted, K products without an image.

## 5. Index rebuild (`build_index.py` — rewritten)

- **Drop the bilingual EN/AR pipeline entirely** (no glossary, no parallel docs). Single doc
  per product. Keep OpenAI `text-embedding-3-small` (multilingual) and the existing
  `rag.store_config()` / `rag.get_embeddings()`.
- `describe(p)` (embedded text) = `f"{p['name_ar']} (كود {p['code']})"`.
- `clean_meta(p)` keeps `code, name_ar, unit, price_jod, image`.
- Rebuild fresh: `shutil.rmtree('./chroma_db_openai')` then `Chroma.from_documents(...)`.
- Run `python ingest_excel.py && python build_index.py` to rebuild end to end.

## 6. Retrieval / `rag.py`

- `retrieve(query, k=8)` — drop the EN/AR dedup (single doc per product) and the `series`
  filter; key any remaining logic on `code`.
- `build_context(results)` lines become Arabic-name + price + code, e.g.
  `- {name_ar} | السعر: {price_jod} JOD | الوحدة: {unit} | كود: {code}`.
- `RELEVANCE_THRESHOLD` — re-tune for the Arabic-only index (keep the `WISEUP_REL_THRESHOLD`
  env knob). Calibrate during implementation with a few Arabic queries vs greetings.

## 7. Cards / UI

### 7.1 `to_card` (tools.py)
New card dict: `code`, `name_ar`, `price_jod`, `unit`, `image_url` (`/images/<code>.png`),
`relevance`. Drop `item_no, product_name(_ar), series(_ar), material(_ar), size, packing,
gross_weight, cbm, pdf_page`.

### 7.2 `frontend/index.html`
- `card(p)` renders: the **image**, the **Arabic name** (RTL), the **code**, and the
  **price** prominently as `${price_jod} JOD`, plus `unit`. Remove the old size/series/G.W./
  CBM fields.
- Remove the **series filter sidebar** and its `fetch('/series')` call. Update the header stat
  (product count; drop the series count).
- Keep `stripMarkdown` + `linkifyCodes` (codes are still 5-6 digits) and RTL rendering for
  Arabic answer text.

## 8. Tools / prompt (`tools.py`, `agent_graph.py`)

- `retrieve_products(query, tool_call_id)` — remove the `series` parameter; update the
  docstring (Arabic catalog with prices).
- `_lookup_products` / `email_owner` — look up by `code`; the lead email lists each product
  with its **price** and a **total (JOD)**. `_format_email` gains a price column + total line.
- `SYSTEM_PROMPT` — state the catalog is Arabic with prices in **JOD**; the agent quotes the
  price when relevant; replies stay card-aligned (short intro, no markdown lists/asterisks);
  the name/phone/email + explicit-yes lead flow is unchanged.

## 9. API (`api.py`)

- Remove the `/series` route and the `SERIES` list; remove `series` from `AskReq` and from the
  graph call. `/ask` and `/reset` otherwise unchanged. `_products` count (for any stat) reads
  the new `products.json`.

## 10. Cleanup — files to DELETE (approved; recoverable from git history)

- **Old source:** `WISEUP 2025 New Product Catalog.pdf`
- **OCR/extract scratch:** `_aggregate.py`, `_extract.py`, `_extract_v2.py`, `_ocr_all.py`,
  `_ocr_headers.py`, `_e.png`, `_t.png`, `_hdr_tmp.png`, `_logohdr.png`, `_ocr_tmp.png`,
  `_extract2.log`, `_extract_progress.log`, `_hdr_progress.log`, `_ocr_progress.log`,
  `_headers.json`, `_ocr_codes.json`, `_series_items.json`, and `_pages/` (all)
- **Old bilingual pipeline:** `apply_ar.py`, `translate_kb.py`, `kb_ar_glossary.json`,
  `products_bilingual.json`
- **Old data/assets:** `products.csv`, the old `products.json` (regenerated), the old
  `images/` crops (replaced by the newly extracted images)
- **Old frontend scratch:** `frontend/_skeleton.html`, `frontend/_stitch_screenshot.png`,
  `frontend/wiseup_stitch.html`
- **Dead code:** `app.py` (old Streamlit/Gemma UI), `memory.py` (retired — replaced by the
  LangGraph checkpointer)

**KEEP:** `agent_graph.py`, `api.py`, `tools.py`, `rag.py`, `runlog.py`, `build_index.py`
(rewritten), `ingest_excel.py` (new), `frontend/index.html`, `tests/`, `docs/`,
`requirements.txt`, `.gitignore`, `start.bat`, `skills-lock.json`, `wiseup_logo.png`, the new
`products.json`, the new `images/`, and `data/wiseup_prices.xlsx`.

## 11. Tests

- `tests/test_tool_helpers.py` — `to_card` asserts the new keys (code, name_ar, price_jod,
  unit, image_url); `_lookup_products` keyed on `code`.
- `tests/test_email_tool.py` — lead body includes price + total JOD; validation unchanged.
- `tests/test_retrieve_tool.py` — `retrieve_products` without `series`; Command updates cards
  with the new schema.
- `tests/test_system_prompt.py` — prompt mentions JOD/price; keeps card + lead rules.
- `tests/test_api.py` — `/ask` returns `{answer, products}` with new card fields; `/series`
  removed.
- `tests/test_ingest.py` (new) — a small helper test: given a stubbed row map and a fake image
  anchor, the code→image filename mapping and the product-row filter behave as specified.
- `tests/test_agent_graph.py` — unchanged (graph topology is the same).

## 12. Out of scope (YAGNI)

- Deriving a "series/category" from the code prefix (no series in the new KB).
- English translation of the new KB (multilingual embeddings cover cross-language matching).
- Auth on `/ask`; RAGAS evaluation (separate task).

## 13. Acceptance criteria

1. `python ingest_excel.py` produces `products.json` (~542 rows) and `images/<code>.png` files
   from the `الصورة` column; `python build_index.py` builds the Chroma index with no errors.
2. An Arabic product query (e.g. `زرادية كهرباء`) returns matching products as cards showing
   the **image, Arabic name, code, and price in JOD**.
3. The agent **quotes prices in JOD** in its replies.
4. The lead-capture flow still works and the owner email lists products **with prices + total**.
5. The repo no longer contains any file in the Part 10 delete list; the source Excel lives at
   `data/wiseup_prices.xlsx`.
6. `python -m pytest -q` is green.
