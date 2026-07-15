# WISEUP Storefront (Phase 1 + 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the 633-product catalog with categories and English names, then ship a public bilingual storefront (landing, catalog, category, product detail) over it.

**Architecture:** Phase 1 is a chain of one-shot scripts under `scripts/`, each writing a reviewable JSON artifact to `data/`, ending in a single atomic merge into `products.json`. Phase 2 adds JSON endpoints to the existing FastAPI app — all product responses routed through one serializer in a new `catalog.py` — plus static Stitch-generated HTML in `frontend/`. No build step, no framework.

**Tech Stack:** Python 3, FastAPI, LangChain (`ChatOpenAI` for translation/classification), Chroma + BM25 (existing RAG), `requests` + `beautifulsoup4` (one-time crawl), Tailwind via CDN (Stitch output), vanilla JS.

**Spec:** `docs/superpowers/specs/2026-07-14-wiseup-storefront-design.md`
**Branch:** `feature/storefront` (off `master`)

## Findings from planning-time investigation (these amend the spec)

These were verified by fetching the live site during planning. They change Phase 1's shape and are binding on the tasks below.

1. **The site has no Arabic.** `https://www.wiseuptools.com/h-col-103.html` and its category pages are English-only. The spec's Phase 1 says "Crawl the series names (AR/EN)" — **only `name_en` is crawlable.** `category_ar` must be LLM-translated (Task 2), not crawled.
2. **The site shows no product codes.** Category pages list product *names* only (e.g. `/h-pr--0_415_5.html` → "Pliers series" → 12 names, no codes). So the crawl **cannot** give us a product→category mapping. It gives category *names* and nothing else. Mapping stays code-prefix + LLM, exactly as the spec's "Category derivation" section assumed.
3. **The site catalog is far smaller than `products.json`.** "Pliers series" lists 12 products; the internal catalog has 633 total. The site is a marketing catalog, not inventory. Do not expect site counts to reconcile with catalog counts.
4. **The real count is 27, not 28** — and after owner review, **26**. Category IDs run 5–32
   with 29 absent, giving 27 crawled series. The owner's "28" and the ~29 code prefixes were
   both close but neither exact. Per the spec, the crawl is the source of truth.
   > **Amended 2026-07-15.** Task 4's distribution showed "Cutting and polishing" (id 22)
   > held a single product while "Cutting" (36) and "Polishing" (27) sat beside it in the
   > menu — the site's own English overlaps. The owner merged id 22 into "Polishing series"
   > (id 8) and dropped it. **The live count is 26**, ids 5–21 and 23–28, 30–32.

5. **Deviation from the spec's data model — categories are normalized.** The spec's table
   puts `category` (English string) and `category_ar` (Arabic string) on every product.
   This plan instead stores `category_id` (int) on each product and keeps the names once in
   `data/categories.json`. Reason: the spec's shape copies both names into all 633 rows, so
   fixing one bad Arabic translation means rewriting the catalog and re-embedding the whole
   index, and nothing prevents two rows from disagreeing about the same category's name.
   The rendered result is identical. **If the owner wants the spec's literal shape, say so
   before Task 5** — after it, the catalog is written.

## Global Constraints

- **Product count is exactly 632, before and after enrichment.** Any script that changes this
  count is broken.
  > **Amended 2026-07-15 (was 633).** The catalog shipped 633 rows but only 632 unique codes:
  > code `81103` appeared twice («ميزان تعليق 100 كيلو» with no image, and «… جديد» with one).
  > A code-keyed catalog cannot hold both, and `/product?code=81103` would have served the
  > imageless row. The owner chose to delete the imageless duplicate. From Task 5 onward the
  > count is **632** and **codes are unique** — that uniqueness is now a real invariant worth
  > testing, not an assumption.
  > **This deletion is not durable yet:** `data/wiseup_prices.xlsx` still holds the duplicate,
  > so re-running `ingest_excel.py` reintroduces it. See "Known follow-ups".
- **No product may lose `code`, `price_jod`, `image`, `unit`, or `name_ar`.** Enrichment is
  additive only — every pre-existing field must stay byte-identical. Note "lose" means
  *changed from what it was*, not *empty*: `81006` has `image: ""` in the source data and
  must still have `image: ""` afterwards. Verify against `data/products.backup.json`, not
  against truthiness.
- **Every product ends with a non-empty `name_en` and exactly one `category_id`.**
- **All product-serving paths call `catalog.serialize_product()`.** Never hand-build a product dict in a route. This is the Phase 3 price-rule chokepoint (spec: "The price rule").
- **`products.json` is written atomically** (temp file + `os.replace`), never truncated in place. It is the only copy of the catalog.
- Prices are visible to everyone in Phase 2 — correct, no accounts exist yet.
- Secrets stay in gitignored `.env`. Never commit `OPENAI_API_KEY` or `TAVILY_API_KEY`.
- Existing tests must keep passing: `python -m pytest -q`. The baseline at the start of
  Phase 1 is **34 passed, 1 skipped** (the skip is `tests/test_smoke_live.py`, opt-in via
  `RUN_LIVE=1`). This count grows as tasks add tests; what matters is that nothing that
  passed before starts failing.
- Commit after every task.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/crawl_categories.py` | **Create.** Fetch category names+ids from the live site → `data/categories.raw.json` |
| `scripts/translate_categories.py` | **Create.** Add `name_ar` to each category → `data/categories.json` |
| `scripts/translate_products.py` | **Create.** 633 × `name_ar` → `name_en` → `data/names_en.json` |
| `scripts/assign_categories.py` | **Create.** 633 × product → `category_id` → `data/assignments.json` |
| `scripts/apply_enrichment.py` | **Create.** Merge the three artifacts into `products.json`, atomically, with integrity gates |
| `catalog.py` | **Create.** Load categories+products; **the single product serializer**; lookups |
| `rag.py` | **Modify.** `clean_meta`/`describe` carry `name_en` + `category_id` |
| `api.py` | **Modify.** Add `/api/categories`, `/api/products`, `/api/products/{code}`, page routes |
| `frontend/catalog.html` | **Create.** All products, filterable |
| `frontend/category.html` | **Create.** One category's products |
| `frontend/product.html` | **Create.** Product detail |
| `frontend/index.html` | **Modify.** Stitch landing page; keeps the chat widget |
| `frontend/static/store.js` | **Create.** Shared i18n + fetch helpers used by all pages |
| `tests/test_enrichment.py` | **Create.** Phase 1 integrity gates |
| `tests/test_catalog.py` | **Create.** Serializer + lookup tests |
| `tests/test_store_api.py` | **Create.** Phase 2 endpoint tests |

---

# Phase 1 — Data Foundation

### Task 1: Crawl category names from the live site

**Files:**
- Create: `scripts/__init__.py` (empty)
- Create: `scripts/crawl_categories.py`
- Create: `data/categories.raw.json` (script output — commit it; it is a reviewable artifact)
- Modify: `requirements.txt`
- Test: `tests/test_enrichment.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `parse_categories(html: str) -> list[dict]` where each dict is
  `{"id": int, "name_en": str, "url": str}`. Written to `data/categories.raw.json`.

- [ ] **Step 1: Add the crawl dependencies**

Append to `requirements.txt`:

```
requests
beautifulsoup4
```

Then run: `pip install requests beautifulsoup4`

- [ ] **Step 2: Write the failing test**

Create `tests/test_enrichment.py`:

```python
from scripts.crawl_categories import parse_categories

SAMPLE_HTML = """
<html><body><ul class="cate">
  <li><a href="/h-pr--0_415_5.html" title="Pliers series">Pliers series</a></li>
  <li><a href="/h-pr--0_415_21.html" title="Wrench series">Wrench series</a></li>
  <li><a href="/h-col-103.html" title="Not a category">Products</a></li>
  <li><a href="/h-pr--0_415_5.html" title="Pliers series">Pliers series</a></li>
</ul></body></html>
"""


def test_parse_categories_extracts_id_name_url():
    cats = parse_categories(SAMPLE_HTML)
    assert {"id": 5, "name_en": "Pliers series",
            "url": "https://www.wiseuptools.com/h-pr--0_415_5.html"} in cats


def test_parse_categories_ignores_non_category_links():
    assert all(c["name_en"] != "Not a category" for c in parse_categories(SAMPLE_HTML))


def test_parse_categories_dedupes_repeated_links():
    cats = parse_categories(SAMPLE_HTML)
    assert len(cats) == 2
    assert [c["id"] for c in cats] == [5, 21]
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python -m pytest tests/test_enrichment.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.crawl_categories'`

- [ ] **Step 4: Write the crawler**

Create `scripts/__init__.py` as an empty file.

Create `scripts/crawl_categories.py`:

```python
"""One-shot: crawl WISEUP series names from the live site.

The site is English-only and shows no product codes, so this yields category
NAMES and nothing else. Arabic names come from translate_categories.py.
"""
import json
import os
import re
import sys
import requests
from bs4 import BeautifulSoup

INDEX_URL = "https://www.wiseuptools.com/h-col-103.html"
BASE = "https://www.wiseuptools.com"
OUT_PATH = "data/categories.raw.json"

# Category links look like: /h-pr--0_415_5.html  (the trailing number is the id)
_HREF_RE = re.compile(r"^/h-pr--0_415_(\d+)\.html$")


def parse_categories(html: str) -> list[dict]:
    """Extract {id, name_en, url} for each series link, in page order, deduped by id."""
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        m = _HREF_RE.match(a["href"].strip())
        if not m:
            continue
        cid = int(m.group(1))
        if cid in seen:
            continue
        name = (a.get("title") or a.get_text()).strip()
        if not name:
            continue
        seen.add(cid)
        out.append({"id": cid, "name_en": name, "url": BASE + a["href"].strip()})
    return out


def main():
    resp = requests.get(INDEX_URL, timeout=30,
                        headers={"User-Agent": "Mozilla/5.0 (WISEUP catalog build)"})
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding
    cats = parse_categories(resp.text)
    if not cats:
        print("ERROR: no categories parsed — the site markup changed.", file=sys.stderr)
        sys.exit(1)
    os.makedirs("data", exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(cats, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(cats)} categories to {OUT_PATH}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python -m pytest tests/test_enrichment.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the crawler against the live site**

Run: `python -m scripts.crawl_categories`
Expected: `wrote 27 categories to data/categories.raw.json`

If the count is not 27, **do not adjust the code to force 27.** The crawl is the source of
truth (spec: Phase 1). Report the actual number and the diff against the 27 known ids
(5–28, 30, 31, 32) before continuing.

- [ ] **Step 7: Eyeball the output**

Run: `python -c "import json;[print(c['id'], c['name_en']) for c in json.load(open('data/categories.raw.json',encoding='utf-8'))]"`

Expected: ids 5–28, 30–32 with names like `Pliers series`, `Wrench series`, `Garden Series`.

- [ ] **Step 8: Commit**

```bash
git add requirements.txt scripts/__init__.py scripts/crawl_categories.py data/categories.raw.json tests/test_enrichment.py
git commit -m "feat: crawl WISEUP series names from live site"
```

---

### Task 2: Translate category names to Arabic

**Files:**
- Create: `scripts/_llm.py` (shared by Tasks 2, 3, 4)
- Create: `scripts/translate_categories.py`
- Create: `data/categories.json` (script output — commit it)
- Test: `tests/test_enrichment.py`

**Interfaces:**
- Consumes: `data/categories.raw.json` from Task 1.
- Produces:
  - `scripts/_llm.py`: `call_json(llm, prompt: str) -> dict` (invokes and parses, tolerating
    a markdown-fenced reply) and `save_json(path: str, data) -> None`. **Tasks 3 and 4
    import these — do not re-implement them there.**
  - `data/categories.json` — the crawled list with `name_ar` added to each entry. This file
    is the **canonical category list** consumed by `catalog.py` (Task 7).
  - `merge_translations(raw: list[dict], names_ar: dict[str, str]) -> list[dict]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_enrichment.py`:

```python
import pytest
from scripts._llm import call_json, save_json
from scripts.translate_categories import merge_translations


class _FakeLLM:
    def __init__(self, content):
        self._content = content

    def invoke(self, _prompt):
        return type("R", (), {"content": self._content})()


def test_call_json_parses_a_plain_json_reply():
    assert call_json(_FakeLLM('{"5": "أ"}'), "p") == {"5": "أ"}


def test_call_json_parses_a_markdown_fenced_reply():
    assert call_json(_FakeLLM('```json\n{"5": "أ"}\n```'), "p") == {"5": "أ"}


def test_call_json_parses_a_bare_fenced_reply():
    assert call_json(_FakeLLM('```\n{"5": "أ"}\n```'), "p") == {"5": "أ"}


def test_save_json_round_trips_arabic_unescaped(tmp_path):
    target = tmp_path / "sub" / "out.json"
    save_json(str(target), {"5": "زرادية"})
    assert "زرادية" in target.read_text(encoding="utf-8")


def test_merge_translations_attaches_arabic_by_id():
    raw = [{"id": 5, "name_en": "Pliers series", "url": "u"}]
    out = merge_translations(raw, {"5": "سلسلة الزراديات"})
    assert out == [{"id": 5, "name_en": "Pliers series", "url": "u",
                    "name_ar": "سلسلة الزراديات"}]


def test_merge_translations_raises_on_missing_translation():
    raw = [{"id": 5, "name_en": "Pliers series", "url": "u"},
           {"id": 6, "name_en": "Measurement series", "url": "u2"}]
    with pytest.raises(ValueError, match="6"):
        merge_translations(raw, {"5": "سلسلة الزراديات"})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_enrichment.py -k "call_json or save_json or translations" -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts._llm'`

- [ ] **Step 3: Write the shared LLM helper**

Create `scripts/_llm.py`:

```python
"""Shared helpers for the one-shot enrichment scripts (Tasks 2, 3, 4)."""
import json
import os


def call_json(llm, prompt: str) -> dict:
    """Invoke the model and parse its reply as JSON.

    Models wrap JSON in markdown fences unpredictably regardless of instructions,
    so strip them before parsing.
    """
    text = llm.invoke(prompt).content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def save_json(path: str, data) -> None:
    """Write JSON, creating the parent directory. Arabic stays readable in the file."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
```

Note `call_json` strips the fence by line, so a ` ```json ` opener is handled without
chaining `removeprefix` calls.

- [ ] **Step 4: Write the translator**

Create `scripts/translate_categories.py`:

```python
"""One-shot: add Arabic names to the crawled categories.

The site has no Arabic, so category_ar is translated, not crawled.
27 items = one LLM call. Owner reviews data/categories.json afterwards.
"""
import json
from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from scripts._llm import call_json, save_json

IN_PATH = "data/categories.raw.json"
OUT_PATH = "data/categories.json"

PROMPT = """You translate hand-tool product category names from English to Arabic.
These are categories in a Jordanian hardware/tools catalog. Use the Arabic trade
vocabulary a Jordanian tool shop would actually use, not literal dictionary Arabic.

Return ONLY a JSON object mapping each id (as a string) to its Arabic name.
No markdown, no commentary.

Categories:
{items}
"""


def merge_translations(raw: list[dict], names_ar: dict) -> list[dict]:
    """Attach name_ar to each category by id. Raises if any category is untranslated."""
    out = []
    for c in raw:
        ar = (names_ar.get(str(c["id"])) or "").strip()
        if not ar:
            raise ValueError(f"no Arabic name returned for category id {c['id']} "
                             f"({c['name_en']!r})")
        out.append({**c, "name_ar": ar})
    return out


def main():
    raw = json.load(open(IN_PATH, encoding="utf-8"))
    items = "\n".join(f'{c["id"]}: {c["name_en"]}' for c in raw)
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    out = merge_translations(raw, call_json(llm, PROMPT.format(items=items)))
    save_json(OUT_PATH, out)
    print(f"wrote {len(out)} categories with Arabic names to {OUT_PATH}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python -m pytest tests/test_enrichment.py -k "call_json or save_json or translations" -v`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the translator**

Run: `python -m scripts.translate_categories`
Expected: `wrote 27 categories with Arabic names to data/categories.json`

- [ ] **Step 7: Print the result for owner review**

Run: `python -c "import json;[print(f\"{c['id']:>3} {c['name_en']:<28} {c['name_ar']}\") for c in json.load(open('data/categories.json',encoding='utf-8'))]"`

**Stop here and show the owner.** These 27 names appear on every page of the storefront;
a wrong one is visible forever. The spec flags trade jargon as an open risk. Do not
proceed to Task 3 until the owner confirms.

- [ ] **Step 8: Commit**

```bash
git add scripts/_llm.py scripts/translate_categories.py data/categories.json tests/test_enrichment.py
git commit -m "feat: Arabic names for the 27 crawled categories"
```

---

### Task 3: Translate 633 product names to English

**Files:**
- Create: `scripts/translate_products.py`
- Create: `data/names_en.json` (script output — commit it)
- Test: `tests/test_enrichment.py`

**Interfaces:**
- Consumes: `products.json` (fields `code`, `name_ar`).
- Produces: `data/names_en.json` — `{"<code>": "<english name>"}` for all 633 codes.
  `chunked(items: list, size: int) -> Iterator[list]`,
  `validate_names(products: list[dict], names: dict) -> None` (raises `ValueError`).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_enrichment.py`:

```python
from scripts.translate_products import chunked, validate_names


def test_chunked_splits_evenly_and_keeps_remainder():
    assert list(chunked([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]


def test_validate_names_passes_when_every_code_has_a_name():
    products = [{"code": "10101", "name_ar": "زرادية"}]
    validate_names(products, {"10101": "Pliers"})


def test_validate_names_raises_on_missing_code():
    products = [{"code": "10101", "name_ar": "زرادية"},
                {"code": "10102", "name_ar": "بكس"}]
    with pytest.raises(ValueError, match="10102"):
        validate_names(products, {"10101": "Pliers"})


def test_validate_names_raises_on_blank_name():
    products = [{"code": "10101", "name_ar": "زرادية"}]
    with pytest.raises(ValueError, match="10101"):
        validate_names(products, {"10101": "   "})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_enrichment.py -k "chunked or validate_names" -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.translate_products'`

- [ ] **Step 3: Write the translator**

Create `scripts/translate_products.py`:

```python
"""One-shot: translate the 633 Arabic product names to English.

Batched at 25/call and cached to data/names_en.json after every batch, so an
interrupted run resumes instead of re-paying for completed batches.
"""
import json
import os
from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from scripts._llm import call_json, save_json

PRODUCTS_PATH = "products.json"
OUT_PATH = "data/names_en.json"
BATCH = 25

PROMPT = """You translate hand-tool product names from Arabic to English for a
Jordanian tools catalog. These are trade names: prefer the term a tool catalogue
would print (e.g. "زرادية" -> "Pliers", "بكس" -> "Socket", "شق رنق" -> "Circlip Pliers").
Keep sizes, inch marks, and numbers exactly as they appear.

Return ONLY a JSON object mapping each product code (as a string) to its English
name. No markdown, no commentary.

Products:
{items}
"""


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def validate_names(products: list[dict], names: dict) -> None:
    """Raise ValueError if any product lacks a non-empty English name."""
    missing = [p["code"] for p in products
               if not (names.get(str(p["code"])) or "").strip()]
    if missing:
        raise ValueError(f"{len(missing)} product(s) have no English name: "
                         f"{missing[:10]}")


def _load_cache() -> dict:
    if os.path.exists(OUT_PATH):
        return json.load(open(OUT_PATH, encoding="utf-8"))
    return {}


def main():
    products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    names = _load_cache()
    todo = [p for p in products if not (names.get(str(p["code"])) or "").strip()]
    print(f"{len(products)} products, {len(names)} already translated, {len(todo)} to go")
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    for i, batch in enumerate(chunked(todo, BATCH), 1):
        items = "\n".join(f'{p["code"]}: {p["name_ar"]}' for p in batch)
        names.update(call_json(llm, PROMPT.format(items=items)))
        save_json(OUT_PATH, names)  # cache after every batch: a crash resumes, not restarts
        print(f"batch {i}: {len(names)}/{len(products)} translated")
    validate_names(products, names)
    save_json(OUT_PATH, names)
    print(f"wrote {len(names)} English names to {OUT_PATH}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_enrichment.py -k "chunked or validate_names" -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the translator**

Run: `python -m scripts.translate_products`
Expected: ~26 batches, ending `wrote 633 English names to data/names_en.json`

This costs real OpenAI spend and takes a few minutes. If it dies partway, re-run it —
the cache resumes.

- [ ] **Step 6: Spot-check 15 translations against their Arabic source**

Run: `python -c "import json,random;p=json.load(open('products.json',encoding='utf-8'));n=json.load(open('data/names_en.json',encoding='utf-8'));random.seed(1);[print(f\"{x['code']:<8}{x['name_ar']:<40}{n[str(x['code'])]}\") for x in random.sample(p,15)]"`

Show the owner. Per the spec's open risks, trade jargon is where this goes wrong.

- [ ] **Step 7: Commit**

```bash
git add scripts/translate_products.py data/names_en.json tests/test_enrichment.py
git commit -m "feat: English names for all 633 products"
```

---

### Task 4: Assign every product to a category

**Files:**
- Create: `scripts/assign_categories.py`
- Create: `data/assignments.json` (script output — commit it)
- Test: `tests/test_enrichment.py`

**Interfaces:**
- Consumes: `products.json`, `data/categories.json` (Task 2), `data/names_en.json` (Task 3).
- Produces: `data/assignments.json` — `{"<code>": <category_id:int>}` for all 633 codes.
  `prefix_of(code: str) -> str`, `group_by_prefix(products: list[dict]) -> dict[str, list[dict]]`,
  `validate_assignments(products: list[dict], assignments: dict, valid_ids: set[int]) -> None`.

**Why not pure prefix mapping:** the spec's "Category derivation" section documents that
prefix group `17` lumps 124 unrelated items and groups `04`/`61`/`70`/`TH` have one product
each. The site gives no codes (Finding 2), so there is nothing to join against. Every
product therefore goes to the LLM with its English name; the prefix is passed as a *hint*
and used to keep sibling products consistent, not as the decision.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_enrichment.py`:

```python
from scripts.assign_categories import prefix_of, group_by_prefix, validate_assignments


def test_prefix_of_takes_first_two_characters():
    assert prefix_of("10101") == "10"
    assert prefix_of("B1234") == "B1"


def test_prefix_of_handles_short_codes():
    assert prefix_of("7") == "7"


def test_group_by_prefix_buckets_products():
    products = [{"code": "10101"}, {"code": "10999"}, {"code": "64001"}]
    groups = group_by_prefix(products)
    assert [p["code"] for p in groups["10"]] == ["10101", "10999"]
    assert [p["code"] for p in groups["64"]] == ["64001"]


def test_validate_assignments_passes_when_all_assigned_to_known_ids():
    validate_assignments([{"code": "10101"}], {"10101": 5}, {5, 6})


def test_validate_assignments_raises_on_unassigned_product():
    with pytest.raises(ValueError, match="10102"):
        validate_assignments([{"code": "10101"}, {"code": "10102"}],
                             {"10101": 5}, {5, 6})


def test_validate_assignments_raises_on_unknown_category_id():
    with pytest.raises(ValueError, match="99"):
        validate_assignments([{"code": "10101"}], {"10101": 99}, {5, 6})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_enrichment.py -k "prefix or group_by or assignments" -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.assign_categories'`

- [ ] **Step 3: Write the assigner**

Create `scripts/assign_categories.py`:

```python
"""One-shot: assign each of the 633 products to exactly one crawled category.

Products are sent to the LLM grouped by code prefix, so sibling products land in
the same series. The prefix is a hint, not the decision — prefix group 17 alone
lumps 124 unrelated items (see the spec's "Category derivation").
Cached to data/assignments.json per group so an interrupted run resumes.
"""
import json
import os
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from scripts._llm import call_json, save_json

PRODUCTS_PATH = "products.json"
CATEGORIES_PATH = "data/categories.json"
NAMES_PATH = "data/names_en.json"
OUT_PATH = "data/assignments.json"

PROMPT = """You are cataloguing a Jordanian hand-tool inventory.

Assign every product below to exactly ONE category id from this list:
{categories}

These products share an internal code prefix, which usually — but NOT always —
means they belong to the same series. Judge each product by its name. If a product
clearly belongs to a different series than its neighbours, put it there.

Return ONLY a JSON object mapping each product code (as a string) to its chosen
category id (an integer). Every code must appear. No markdown, no commentary.

Products:
{items}
"""


def prefix_of(code: str) -> str:
    return str(code)[:2]


def group_by_prefix(products: list[dict]) -> dict:
    groups = defaultdict(list)
    for p in products:
        groups[prefix_of(p["code"])].append(p)
    return dict(groups)


def validate_assignments(products: list[dict], assignments: dict,
                         valid_ids: set) -> None:
    """Raise ValueError if any product is unassigned or points at an unknown category."""
    missing = [p["code"] for p in products if str(p["code"]) not in assignments]
    if missing:
        raise ValueError(f"{len(missing)} product(s) unassigned: {missing[:10]}")
    bad = {c: cid for c, cid in assignments.items() if cid not in valid_ids}
    if bad:
        raise ValueError(f"{len(bad)} assignment(s) use unknown category ids: "
                         f"{dict(list(bad.items())[:10])}")


def main():
    products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    categories = json.load(open(CATEGORIES_PATH, encoding="utf-8"))
    names_en = json.load(open(NAMES_PATH, encoding="utf-8"))
    valid_ids = {c["id"] for c in categories}
    cat_list = "\n".join(f'{c["id"]}: {c["name_en"]}' for c in categories)

    assignments = json.load(open(OUT_PATH, encoding="utf-8")) if os.path.exists(OUT_PATH) else {}
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    for prefix, group in sorted(group_by_prefix(products).items()):
        if all(str(p["code"]) in assignments for p in group):
            continue
        items = "\n".join(
            f'{p["code"]}: {names_en.get(str(p["code"]), "")} | {p["name_ar"]}'
            for p in group)
        reply = call_json(llm, PROMPT.format(categories=cat_list, items=items))
        assignments.update({str(k): int(v) for k, v in reply.items()})
        save_json(OUT_PATH, assignments)  # cache per group: a crash resumes, not restarts
        print(f"prefix {prefix}: {len(group)} product(s) → "
              f"{len(assignments)}/{len(products)} assigned")

    validate_assignments(products, assignments, valid_ids)
    save_json(OUT_PATH, assignments)
    print(f"wrote {len(assignments)} assignments to {OUT_PATH}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_enrichment.py -k "prefix or group_by or assignments" -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the assigner**

Run: `python -m scripts.assign_categories`
Expected: one line per prefix group, ending `wrote 633 assignments to data/assignments.json`

- [ ] **Step 6: Print the category distribution for owner review**

Run: `python -c "import json;from collections import Counter;a=json.load(open('data/assignments.json',encoding='utf-8'));c={x['id']:x['name_en'] for x in json.load(open('data/categories.json',encoding='utf-8'))};[print(f'{n:>4}  {c[i]}') for i,n in Counter(a.values()).most_common()]"`

**Stop and show the owner.** The spec names this the most likely place for the mapping to
look bad. Two specific checks: no category should hold anything like 124 products (that
would mean prefix group 17 was copied wholesale instead of split), and no crawled category
should end up with zero products — an empty category renders as an empty page.

- [ ] **Step 7: Commit**

```bash
git add scripts/assign_categories.py data/assignments.json tests/test_enrichment.py
git commit -m "feat: assign all 633 products to crawled categories"
```

---

### Task 5: Apply the enrichment to products.json

**Files:**
- Create: `scripts/apply_enrichment.py`
- Modify: `products.json` (script output)
- Test: `tests/test_enrichment.py`

**Interfaces:**
- Consumes: `products.json`, `data/names_en.json`, `data/assignments.json`.
- Produces: enriched `products.json` — each product gains `name_en` (str) and
  `category_id` (int). `enrich(products, names_en, assignments) -> list[dict]`,
  `write_atomic(path: str, data) -> None`.

This is the only task that touches the real catalog. It is additive and atomic.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_enrichment.py`:

```python
import json as _json
from scripts.apply_enrichment import enrich, write_atomic

_BASE = [{"code": "10101", "name_ar": "زرادية", "unit": "pcs",
          "price_jod": 2.5, "image": "images/10101.png"}]


def test_enrich_adds_name_en_and_category_id():
    out = enrich(_BASE, {"10101": "Pliers"}, {"10101": 5})
    assert out[0]["name_en"] == "Pliers"
    assert out[0]["category_id"] == 5


def test_enrich_preserves_every_existing_field():
    out = enrich(_BASE, {"10101": "Pliers"}, {"10101": 5})
    for key, value in _BASE[0].items():
        assert out[0][key] == value


def test_enrich_preserves_product_count_and_order():
    base = _BASE + [{"code": "10102", "name_ar": "بكس", "unit": "pcs",
                     "price_jod": 1.0, "image": "images/10102.png"}]
    out = enrich(base, {"10101": "Pliers", "10102": "Socket"},
                 {"10101": 5, "10102": 6})
    assert [p["code"] for p in out] == ["10101", "10102"]


def test_enrich_raises_rather_than_writing_a_partial_catalog():
    with pytest.raises(ValueError, match="10101"):
        enrich(_BASE, {}, {"10101": 5})


def test_write_atomic_leaves_the_original_intact_on_failure(tmp_path):
    target = tmp_path / "products.json"
    target.write_text('["original"]', encoding="utf-8")

    class Unserializable:
        pass

    try:
        write_atomic(str(target), [Unserializable()])
    except TypeError:
        pass
    assert _json.loads(target.read_text(encoding="utf-8")) == ["original"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_enrichment.py -k "enrich or write_atomic" -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.apply_enrichment'`

- [ ] **Step 3: Write the merger**

Create `scripts/apply_enrichment.py`:

```python
"""One-shot: merge names_en + assignments into products.json.

Additive and atomic. products.json is the only copy of the catalog: this script
either rewrites it completely and correctly, or leaves it exactly as it was.
"""
import json
import os
import shutil
import tempfile

PRODUCTS_PATH = "products.json"
NAMES_PATH = "data/names_en.json"
ASSIGNMENTS_PATH = "data/assignments.json"
BACKUP_PATH = "data/products.backup.json"


def enrich(products: list[dict], names_en: dict, assignments: dict) -> list[dict]:
    """Return products with name_en and category_id added. Raises if anything is missing."""
    out = []
    for p in products:
        code = str(p["code"])
        name_en = (names_en.get(code) or "").strip()
        cat_id = assignments.get(code)
        if not name_en:
            raise ValueError(f"product {code} has no English name")
        if cat_id is None:
            raise ValueError(f"product {code} has no category assignment")
        out.append({**p, "name_en": name_en, "category_id": int(cat_id)})
    return out


def write_atomic(path: str, data) -> None:
    """Serialize fully to a temp file, then replace. A failure leaves `path` untouched."""
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def main():
    products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    names_en = json.load(open(NAMES_PATH, encoding="utf-8"))
    assignments = json.load(open(ASSIGNMENTS_PATH, encoding="utf-8"))
    before = len(products)

    os.makedirs("data", exist_ok=True)
    shutil.copyfile(PRODUCTS_PATH, BACKUP_PATH)

    enriched = enrich(products, names_en, assignments)
    if len(enriched) != before:
        raise ValueError(f"product count changed: {before} -> {len(enriched)}")

    write_atomic(PRODUCTS_PATH, enriched)
    print(f"enriched {len(enriched)} products (backup at {BACKUP_PATH})")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_enrichment.py -k "enrich or write_atomic" -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Apply the enrichment**

Run: `python -m scripts.apply_enrichment`
Expected: `enriched 632 products (backup at data/products.backup.json)`

- [ ] **Step 6: Verify the catalog against the spec's Phase 1 acceptance criteria**

Run:

```bash
python -c "
import json
from collections import Counter
p = json.load(open('products.json', encoding='utf-8'))
c = json.load(open('data/categories.json', encoding='utf-8'))
before = {str(x['code']): x for x in json.load(open('data/products.backup.json', encoding='utf-8'))}
ids = {x['id'] for x in c}

# the enrichment added what it promised
assert len(p) == 632, f'count is {len(p)}, expected 632'
codes = [str(x['code']) for x in p]
assert len(codes) == len(set(codes)), 'product codes are not unique'
assert all(x.get('name_en','').strip() for x in p), 'a product has no name_en'
assert all(x.get('category_id') in ids for x in p), 'a product has a bad category_id'

# ...and changed nothing else. 'Additive only' means every pre-existing field is
# byte-identical to the backup — NOT that every field is non-empty. One product
# (81006 قاعدة لفل) has always had image='' and legitimately still does.
assert set(before) == set(codes), 'the set of product codes changed'
for x in p:
    o = before[str(x['code'])]
    for f in ('name_ar', 'unit', 'price_jod', 'image'):
        assert x[f] == o[f], f'enrichment CHANGED {f} on product {x[\"code\"]}'

used = set(Counter(x['category_id'] for x in p))
print('632 products OK, all pre-existing fields unchanged')
print('categories used:', len(used), 'of', len(ids))
print('products with no image:', sum(1 for x in p if not x['image']), '(expected 1: 81006)')
print('EMPTY categories:', [x['name_en'] for x in c if x['id'] not in used] or 'none')
"
```

Expected: all asserts pass; `products with no image: 1`. Empty categories are a warning, not
a failure — report them to the owner; an empty category renders as an empty page in Phase 2.

> **Why this checks the backup rather than checking for non-empty values.** The Global
> Constraint is "no product may *lose* `code`, `price_jod`, `image`, `unit`, or `name_ar`
> — enrichment is additive only". Asserting `x['image']` is truthy tests a different and
> false claim: the catalog ships 631 images for 632 products (see the Data model table), so
> `81006` has no image and never did. An earlier version of this block conflated the two
> and blocked Task 5 on data that was correct. Diffing against `data/products.backup.json`
> tests the real invariant.

- [ ] **Step 7: Commit**

```bash
git add scripts/apply_enrichment.py products.json data/products.backup.json tests/test_enrichment.py
git commit -m "feat: enrich products.json with name_en and category_id"
```

---

### Task 6: Carry the new fields into the RAG index

**Files:**
- Modify: `rag.py:30-41` (`describe`, `clean_meta`)
- Test: `tests/test_rag_hybrid.py`

**Interfaces:**
- Consumes: enriched `products.json` from Task 5.
- Produces: `rag.clean_meta(p)` gains `name_en` and `category_id`; `rag.describe(p)`
  includes the English name. `to_card()` in `tools.py` reads `doc.metadata`, so the new
  fields become available to the agent automatically.

**Why this task exists:** `rag.clean_meta()` hard-codes the metadata whitelist, so
enrichment is invisible to retrieval until this changes. `build_index.py` calls
`shutil.rmtree(persist)` before rebuilding — the index is destroyed and recreated, so a
failed rebuild leaves the assistant with no index. Rebuild before you commit, and confirm
it worked.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rag_hybrid.py`:

```python
import rag


def test_clean_meta_carries_name_en_and_category_id():
    meta = rag.clean_meta({"code": "10101", "name_ar": "زرادية", "unit": "pcs",
                           "price_jod": 2.5, "image": "images/10101.png",
                           "name_en": "Pliers", "category_id": 5})
    assert meta["name_en"] == "Pliers"
    assert meta["category_id"] == 5


def test_clean_meta_tolerates_products_missing_the_new_fields():
    meta = rag.clean_meta({"code": "10101", "name_ar": "زرادية"})
    assert meta["name_en"] == ""
    assert meta["category_id"] == 0


def test_describe_includes_both_languages_so_english_queries_retrieve():
    text = rag.describe({"code": "10101", "name_ar": "زرادية", "name_en": "Pliers"})
    assert "زرادية" in text
    assert "Pliers" in text
    assert "10101" in text
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_rag_hybrid.py -k "clean_meta or describe" -v`
Expected: FAIL — `KeyError: 'name_en'` / assertion error on `describe`

- [ ] **Step 3: Update `rag.py`**

Replace `describe` and `clean_meta` (currently `rag.py:30-41`) with:

```python
def describe(p):
    """Indexed text. Both languages, so English queries retrieve Arabic-named products."""
    name_en = (p.get("name_en") or "").strip()
    tail = f" / {name_en}" if name_en else ""
    return f"{p['name_ar']}{tail} (كود {p['code']})"


def clean_meta(p):
    return {
        "code": p.get("code", ""),
        "name_ar": p.get("name_ar", ""),
        "name_en": p.get("name_en", ""),
        "category_id": p.get("category_id", 0),
        "unit": p.get("unit", ""),
        "price_jod": p.get("price_jod", 0),
        "image": p.get("image", ""),
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_rag_hybrid.py -k "clean_meta or describe" -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Rebuild the index**

Run: `python build_index.py`
Expected: `indexed 632 products into ./chroma_db_openai/wiseup_products_openai`

This deletes and recreates the index and costs OpenAI embedding spend. If it fails
partway, the assistant has no index until you re-run it successfully.

- [ ] **Step 6: Confirm retrieval still works, including in English**

Run:

```bash
python -c "
import rag
for q in ['زرادية', 'pliers', 'saw']:
    docs = rag.hybrid_retrieve(q, k=3)
    print(q, '->', [d.metadata['code'] for d in docs] or 'NOTHING')
"
```

Expected: each query returns codes, not `NOTHING`. `pliers` returning results is the point
of this task — before it, the index held no English at all.

- [ ] **Step 7: Run the full suite**

Run: `python -m pytest -q`
Expected: all pass (1 skipped — `test_smoke_live.py` is opt-in via `RUN_LIVE=1`)

- [ ] **Step 8: Commit**

```bash
git add rag.py tests/test_rag_hybrid.py
git commit -m "feat: index name_en and category_id; English queries now retrieve"
```

---

# Phase 2 — Public Storefront

### Task 7: The catalog module and its serializer chokepoint

**Files:**
- Create: `catalog.py`
- Modify: `tools.py:21-31` (`to_card` delegates to the serializer)
- Test: `tests/test_catalog.py`

**Interfaces:**
- Consumes: enriched `products.json`, `data/categories.json`.
- Produces — **every later task depends on these exact signatures:**
  - `load_categories() -> list[dict]` — cached; each `{id, name_en, name_ar, url}`
  - `load_products() -> list[dict]` — cached, raw dicts
  - `serialize_product(p: dict, include_price: bool = True) -> dict` — **the chokepoint**
  - `list_products(category_id: int | None = None, include_price: bool = True) -> list[dict]`
  - `get_product(code: str, include_price: bool = True) -> dict | None`
  - `list_categories() -> list[dict]` — each with a `count` field

**This is the load-bearing task of the whole plan.** The spec's price rule says omission
must live in "one chokepoint function that every product-returning path calls". Phase 3
adds `include_price=False` for business accounts here and nowhere else. The `include_price`
parameter exists from day one, unused-but-tested, so Phase 3 is a one-line change rather
than a retrofit of every endpoint.

- [ ] **Step 1: Write the failing test**

Create `tests/test_catalog.py`:

```python
import pytest
import catalog

P = {"code": "10101", "name_ar": "زرادية", "name_en": "Pliers", "unit": "pcs",
     "price_jod": 2.5, "image": "images/10101.png", "category_id": 5}


def test_serialize_product_includes_price_by_default():
    assert catalog.serialize_product(P)["price_jod"] == 2.5


def test_serialize_product_omits_price_entirely_when_asked():
    out = catalog.serialize_product(P, include_price=False)
    assert "price_jod" not in out, "the key must be absent, not None — DevTools reads None"


def test_serialize_product_exposes_a_web_image_url():
    assert catalog.serialize_product(P)["image_url"] == "/images/10101.png"


def test_serialize_product_normalizes_windows_image_separators():
    out = catalog.serialize_product({**P, "image": "images\\10101.png"})
    assert out["image_url"] == "/images/10101.png"


def test_serialize_product_keeps_both_names_and_the_category():
    out = catalog.serialize_product(P)
    assert out["name_ar"] == "زرادية"
    assert out["name_en"] == "Pliers"
    assert out["category_id"] == 5


def test_serialize_product_never_leaks_unlisted_fields():
    out = catalog.serialize_product({**P, "cost_price": 0.9, "supplier": "secret"})
    assert "cost_price" not in out
    assert "supplier" not in out


def test_list_products_filters_by_category(monkeypatch):
    monkeypatch.setattr(catalog, "load_products",
                        lambda: [P, {**P, "code": "20202", "category_id": 6}])
    assert [p["code"] for p in catalog.list_products(category_id=5)] == ["10101"]


def test_list_products_returns_everything_without_a_filter(monkeypatch):
    monkeypatch.setattr(catalog, "load_products",
                        lambda: [P, {**P, "code": "20202", "category_id": 6}])
    assert len(catalog.list_products()) == 2


def test_list_products_propagates_price_omission(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert all("price_jod" not in p for p in catalog.list_products(include_price=False))


def test_get_product_finds_by_code(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert catalog.get_product("10101")["name_en"] == "Pliers"


def test_get_product_returns_none_for_unknown_code(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert catalog.get_product("99999") is None


def test_get_product_propagates_price_omission(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert "price_jod" not in catalog.get_product("10101", include_price=False)


def test_list_categories_counts_products(monkeypatch):
    monkeypatch.setattr(catalog, "load_categories",
                        lambda: [{"id": 5, "name_en": "Pliers series",
                                  "name_ar": "الزراديات", "url": "u"}])
    monkeypatch.setattr(catalog, "load_products", lambda: [P, {**P, "code": "10102"}])
    assert catalog.list_categories()[0]["count"] == 2


def test_the_real_catalog_loads_and_every_product_serializes():
    products = catalog.list_products()
    assert len(products) == 632
    assert all(p["name_en"] and p["image_url"] for p in products)


def test_the_real_catalog_has_unique_codes():
    # get_product() returns the first match, so a duplicate code silently shadows a
    # product. One duplicate (81103) already shipped and was removed by hand in Task 4.
    codes = [p["code"] for p in catalog.list_products()]
    assert len(codes) == len(set(codes))
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_catalog.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'catalog'`

- [ ] **Step 3: Write `catalog.py`**

```python
"""The catalog read layer — and the one place a product becomes JSON.

Every product-serving path (API, agent tools, pages) goes through
serialize_product(). Phase 3 turns `include_price` off for business accounts here,
once. Hiding a price in HTML is not hiding it; the key must never be serialized.
See docs/superpowers/specs/2026-07-14-wiseup-storefront-design.md — "The price rule".
"""
import json

PRODUCTS_PATH = "products.json"
CATEGORIES_PATH = "data/categories.json"

_products = None
_categories = None


def load_products() -> list[dict]:
    global _products
    if _products is None:
        with open(PRODUCTS_PATH, encoding="utf-8") as f:
            _products = json.load(f)
    return _products


def load_categories() -> list[dict]:
    global _categories
    if _categories is None:
        with open(CATEGORIES_PATH, encoding="utf-8") as f:
            _categories = json.load(f)
    return _categories


def serialize_product(p: dict, include_price: bool = True) -> dict:
    """Turn a raw product into its public JSON shape.

    Allowlist, not blocklist: a new column in products.json must be added here
    deliberately before it can reach a browser.
    """
    image = (p.get("image") or "").replace("\\", "/")
    out = {
        "code": str(p.get("code", "")),
        "name_ar": p.get("name_ar", ""),
        "name_en": p.get("name_en", ""),
        "unit": p.get("unit", ""),
        "category_id": p.get("category_id", 0),
        "image_url": ("/" + image.lstrip("/")) if image else "",
    }
    if include_price:
        out["price_jod"] = p.get("price_jod", 0)
    return out


def list_products(category_id: int = None, include_price: bool = True) -> list[dict]:
    products = load_products()
    if category_id is not None:
        products = [p for p in products if p.get("category_id") == category_id]
    return [serialize_product(p, include_price) for p in products]


def get_product(code: str, include_price: bool = True) -> dict:
    for p in load_products():
        if str(p.get("code")) == str(code):
            return serialize_product(p, include_price)
    return None


def list_categories() -> list[dict]:
    counts = {}
    for p in load_products():
        cid = p.get("category_id")
        counts[cid] = counts.get(cid, 0) + 1
    return [{**c, "count": counts.get(c["id"], 0)} for c in load_categories()]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_catalog.py -v`
Expected: PASS (14 tests)

- [ ] **Step 5: Write the failing test for the agent's card builder**

The spec names `retrieve_products` as one of the paths that must go through the chokepoint:
"catalog API, product detail, search, **and the agent's `retrieve_products` tool**". Today
`tools.to_card()` (`tools.py:21-31`) hand-builds its own dict — a second, parallel
serializer. In Phase 3 that is exactly how the agent leaks a price to a business account
while the API correctly withholds it.

Append to `tests/test_catalog.py`:

```python
from langchain_core.documents import Document
import tools


def _doc():
    return Document(page_content="زرادية", metadata=dict(P))


def test_to_card_uses_the_serializer_and_keeps_the_relevance_badge():
    card = tools.to_card(_doc(), 95)
    assert card["code"] == "10101"
    assert card["image_url"] == "/images/10101.png"
    assert card["price_jod"] == 2.5
    assert card["relevance"] == 95


def test_to_card_can_omit_the_price_for_phase_3():
    assert "price_jod" not in tools.to_card(_doc(), 95, include_price=False)
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `python -m pytest tests/test_catalog.py -k to_card -v`
Expected: FAIL — `TypeError: to_card() got an unexpected keyword argument 'include_price'`

- [ ] **Step 7: Route `to_card` through the serializer**

In `tools.py`, add the import beside `import rag`:

```python
import catalog
```

Replace `to_card` (`tools.py:21-31`) with:

```python
def to_card(doc, relevance, include_price: bool = True):
    """Build a product card from a retrieved doc.

    Delegates to catalog.serialize_product so the agent cannot drift from the API's
    idea of what a product looks like — and so Phase 3's price rule covers the agent
    by construction. See the spec's "The price rule".
    """
    card = catalog.serialize_product(doc.metadata, include_price=include_price)
    card["relevance"] = int(relevance)
    return card
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `python -m pytest tests/test_catalog.py -v`
Expected: PASS (16 tests)

- [ ] **Step 9: Confirm the agent's existing tests still pass**

Run: `python -m pytest tests/test_retrieve_tool.py tests/test_tool_helpers.py -v`
Expected: PASS. `to_card` now emits `name_en` and `category_id` as well; if a test asserts
an exact dict, update it to assert the fields it cares about rather than the whole shape.

- [ ] **Step 10: Commit**

```bash
git add catalog.py tools.py tests/test_catalog.py
git commit -m "feat: catalog module with the single product serializer chokepoint"
```

---

### Task 8: Storefront JSON endpoints

**Files:**
- Modify: `api.py` (add routes after the existing `/` route at `api.py:50-52`)
- Test: `tests/test_store_api.py`

**Interfaces:**
- Consumes: `catalog.list_categories`, `catalog.list_products`, `catalog.get_product` (Task 7).
- Produces: `GET /api/categories` → `{"categories": [...]}`;
  `GET /api/products?category_id=<int>` → `{"products": [...]}`;
  `GET /api/products/{code}` → a serialized product, or 404.
  The frontend tasks consume exactly these shapes.

- [ ] **Step 1: Write the failing test**

Create `tests/test_store_api.py`:

```python
import json
from fastapi.testclient import TestClient
import api

client = TestClient(api.app)


def test_categories_endpoint_returns_every_crawled_category():
    # Assert against the crawl artifact, not a hardcoded number: the spec makes the
    # crawl the source of truth for the category count.
    expected = json.load(open("data/categories.json", encoding="utf-8"))
    r = client.get("/api/categories")
    assert r.status_code == 200
    cats = r.json()["categories"]
    assert len(cats) == len(expected)
    assert all({"id", "name_en", "name_ar", "count"} <= set(c) for c in cats)


def test_products_endpoint_returns_the_whole_catalog():
    r = client.get("/api/products")
    assert r.status_code == 200
    assert len(r.json()["products"]) == 632


def test_products_endpoint_filters_by_category():
    cid = client.get("/api/categories").json()["categories"][0]["id"]
    products = client.get(f"/api/products?category_id={cid}").json()["products"]
    assert products, "the first category should not be empty"
    assert all(p["category_id"] == cid for p in products)


def test_product_detail_returns_the_product():
    code = client.get("/api/products").json()["products"][0]["code"]
    r = client.get(f"/api/products/{code}")
    assert r.status_code == 200
    assert r.json()["code"] == code


def test_product_detail_404s_for_an_unknown_code():
    assert client.get("/api/products/nope-does-not-exist").status_code == 404


def test_storefront_pages_are_served():
    for path in ["/", "/catalog", "/category", "/product"]:
        assert client.get(path).status_code == 200, f"{path} did not serve"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_store_api.py -v`
Expected: FAIL — 404s on every `/api/*` route

- [ ] **Step 3: Add the routes**

In `api.py`, add `catalog` to the imports (beside `from agent_graph import graph`):

```python
import catalog
```

and add `HTTPException` to the FastAPI import:

```python
from fastapi import FastAPI, HTTPException
```

Then add these routes immediately after the existing `index()` route (`api.py:50-52`):

```python
@app.get("/catalog")
def catalog_page():
    return FileResponse("frontend/catalog.html")


@app.get("/category")
def category_page():
    return FileResponse("frontend/category.html")


@app.get("/product")
def product_page():
    return FileResponse("frontend/product.html")


@app.get("/api/categories")
def api_categories():
    return {"categories": catalog.list_categories()}


@app.get("/api/products")
def api_products(category_id: Optional[int] = None):
    # include_price is unconditional in Phase 2 — no accounts exist yet. Phase 3
    # resolves it from the caller's role and passes it straight through.
    return {"products": catalog.list_products(category_id=category_id)}


@app.get("/api/products/{code}")
def api_product(code: str):
    product = catalog.get_product(code)
    if product is None:
        raise HTTPException(status_code=404, detail="product not found")
    return product
```

Also mount the static directory next to the existing `/images` mount (`api.py:18`):

```python
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
```

- [ ] **Step 4: Create the static directory so the mount does not crash at import**

```bash
mkdir -p frontend/static
touch frontend/static/.gitkeep
```

- [ ] **Step 5: Run the test to verify the API passes**

Run: `python -m pytest tests/test_store_api.py -v -k "categories or products or product_detail"`
Expected: PASS. `test_storefront_pages_are_served` still fails — the HTML does not exist
until Tasks 9–11. That is expected; leave it failing.

- [ ] **Step 6: Commit**

```bash
git add api.py tests/test_store_api.py frontend/static/.gitkeep
git commit -m "feat: storefront JSON endpoints via the catalog serializer"
```

---

### Task 9: Stitch design system and screen generation

**Files:**
- Create: `frontend/stitch/` (raw Stitch output, committed as the design source of record)

**Interfaces:**
- Consumes: nothing in code.
- Produces: raw HTML for four screens, saved under `frontend/stitch/`. Tasks 10–12 adapt
  this markup; they do not regenerate it.

**Stitch generates design only.** It does not know about our API, our data, or the price
rule. Treat its output as a visual starting point to be wired up, not as a working page.

- [ ] **Step 1: Create the project and design system**

Use the Stitch MCP tools with exactly these parameters (from the spec's "Stitch workflow"):

```
create_project        name: "WISEUP Store"
create_design_system  customColor:   #E60616
                      headlineFont:  OSWALD
                      bodyFont:      INTER
                      roundness:     ROUND_FOUR
                      colorMode:     LIGHT
```

These match the brand red and Oswald headline already in `frontend/index.html`.

- [ ] **Step 2: Generate the four screens**

`generate_screen_from_text` with `modelId: GEMINI_3_1_PRO`, `deviceType: DESKTOP`, once per
screen. Tell it the catalog is Arabic-first and right-to-left:

- **Landing** — hero for WISEUP hand tools, a grid of 26 tool-category cards, a featured-products
  strip, footer. Arabic-first, RTL, with an AR/EN toggle in the header.
- **Catalog** — every product in a responsive card grid; each card shows an image, name,
  code, unit and price; a category filter sidebar; a search box.
- **Category** — one series: heading, product count, the same product card grid.
- **Product detail** — large image, Arabic and English name, code, unit, price, quantity
  selector, an "add to cart" primary button, and a related-products strip from the same series.

- [ ] **Step 3: Save the raw output**

Retrieve each screen's code and save verbatim to `frontend/stitch/index.html`,
`catalog.html`, `category.html`, `product.html`. Do not edit them in this task —
committing the raw output unmodified makes the next tasks' diffs show exactly what we
changed away from the design.

- [ ] **Step 4: Confirm the output is what we expect**

Run: `grep -l "tailwind" frontend/stitch/*.html`
Expected: all four files listed. Stitch emits Tailwind-CDN HTML — if any file contains
`import React` or `export default`, the wrong generator ran; regenerate it.

- [ ] **Step 5: Commit**

```bash
git add frontend/stitch/
git commit -m "design: raw Stitch screens for the storefront (GEMINI_3_1_PRO)"
```

---

### Task 10: Shared frontend helpers (i18n, fetch, cards)

**Files:**
- Create: `frontend/static/store.js`
- Test: manual (browser)

**Interfaces:**
- Consumes: `/api/categories`, `/api/products` (Task 8).
- Produces, on `window.WISEUP`:
  - `lang()` → `"ar" | "en"`, `setLang(l)`, `applyDir()`
  - `t(product)` → the name in the active language
  - `esc(s)` → HTML-escaped string
  - `money(p)` → `"2.5 JOD"` / `"٢.٥ دينار"`, or `""` when `price_jod` is absent
  - `productCard(p)` → HTML string
  - `getJSON(url)` → parsed JSON

**`money()` must return empty string when `price_jod` is missing, not "0" or "undefined".**
In Phase 3 business accounts get products with no `price_jod` key at all; the card has to
render sensibly without one. Building that in now costs nothing and means Phase 3 does not
touch this file.

- [ ] **Step 1: Write `frontend/static/store.js`**

```javascript
/* Shared storefront helpers. Loaded by every page before its own script. */
(function () {
  const LANGS = { ar: { dir: "rtl", money: (v) => `${v} دينار` },
                  en: { dir: "ltr", money: (v) => `${v} JOD` } };

  function lang() {
    return localStorage.getItem("wiseup_lang") || "ar";
  }

  function setLang(l) {
    localStorage.setItem("wiseup_lang", l);
    location.reload();
  }

  function applyDir() {
    const l = lang();
    document.documentElement.lang = l;
    document.documentElement.dir = LANGS[l].dir;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function t(p) {
    return lang() === "en" ? (p.name_en || p.name_ar) : (p.name_ar || p.name_en);
  }

  function money(p) {
    // No price_jod key = a business account (Phase 3) or bad data. Render nothing.
    if (p == null || p.price_jod === undefined || p.price_jod === null) return "";
    return LANGS[lang()].money(p.price_jod);
  }

  function productCard(p) {
    const price = money(p);
    return `
      <a href="/product?code=${encodeURIComponent(p.code)}"
         class="block rounded border hover:shadow-lg transition p-3 bg-white">
        <img src="${esc(p.image_url)}" alt="${esc(t(p))}" loading="lazy"
             class="w-full h-40 object-contain mb-2"
             onerror="this.style.visibility='hidden'">
        <div class="text-sm font-semibold line-clamp-2">${esc(t(p))}</div>
        <div class="text-xs text-gray-500 mt-1">${esc(p.code)} · ${esc(p.unit)}</div>
        ${price ? `<div class="text-brand font-bold mt-1">${esc(price)}</div>` : ""}
      </a>`;
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  }

  window.WISEUP = { lang, setLang, applyDir, esc, t, money, productCard, getJSON };
})();
```

- [ ] **Step 2: Verify the price-absent case by hand**

Start the server: `python -m uvicorn api:app --host 127.0.0.1 --port 8001`
(The app takes 20–40 seconds to import — Chroma and OpenAI init. Wait for
"Application startup complete" before assuming it hung.)

Open http://127.0.0.1:8001/ and run in the browser console:

```javascript
WISEUP.money({ price_jod: 2.5 })   // "2.5 دينار"
WISEUP.money({})                   // ""  <- the Phase 3 case
WISEUP.money({ price_jod: null })  // ""
```

Expected: exactly those three results. If `WISEUP.money({})` returns `"undefined دينار"`,
fix it now — that string would ship to every business account in Phase 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/static/store.js
git commit -m "feat: shared storefront helpers (i18n, cards, price-absent safe)"
```

---

### Task 11: Catalog and category pages

**Files:**
- Create: `frontend/catalog.html` (adapted from `frontend/stitch/catalog.html`)
- Create: `frontend/category.html` (adapted from `frontend/stitch/category.html`)
- Test: `tests/test_store_api.py` (the page-serving test from Task 8)

**Interfaces:**
- Consumes: `window.WISEUP` (Task 10); `/api/categories`, `/api/products` (Task 8).
- Produces: `/catalog` and `/category?id=<int>` render.

- [ ] **Step 1: Build `frontend/catalog.html`**

Start from `frontend/stitch/catalog.html`. Keep its markup and Tailwind config; replace its
placeholder product grid with a container the script fills. It must include, before its own
script:

```html
<script src="/static/store.js"></script>
```

and this page script:

```html
<script>
  WISEUP.applyDir();
  const grid = document.getElementById("product-grid");
  const filter = document.getElementById("category-filter");
  const search = document.getElementById("search");
  let all = [];

  function render(items) {
    grid.innerHTML = items.length
      ? items.map(WISEUP.productCard).join("")
      : `<p class="col-span-full text-center text-gray-500 py-12">لا توجد نتائج / No results</p>`;
  }

  function apply() {
    const cid = filter.value ? Number(filter.value) : null;
    const q = search.value.trim().toLowerCase();
    render(all.filter((p) =>
      (cid === null || p.category_id === cid) &&
      (!q || `${p.name_ar} ${p.name_en} ${p.code}`.toLowerCase().includes(q))));
  }

  (async () => {
    const [{ categories }, { products }] = await Promise.all([
      WISEUP.getJSON("/api/categories"),
      WISEUP.getJSON("/api/products"),
    ]);
    all = products;
    filter.innerHTML = `<option value="">${WISEUP.lang() === "en" ? "All" : "الكل"}</option>` +
      categories.map((c) => `<option value="${c.id}">${WISEUP.esc(
        WISEUP.lang() === "en" ? c.name_en : c.name_ar)} (${c.count})</option>`).join("");
    filter.addEventListener("change", apply);
    search.addEventListener("input", apply);
    render(all);
  })();
</script>
```

The markup must provide `#product-grid`, `#category-filter` (a `<select>`), and `#search`
(an `<input>`).

- [ ] **Step 2: Build `frontend/category.html`**

Same approach, reading the id from the query string:

```html
<script src="/static/store.js"></script>
<script>
  WISEUP.applyDir();
  const id = Number(new URLSearchParams(location.search).get("id"));
  const grid = document.getElementById("product-grid");
  const heading = document.getElementById("category-name");
  const count = document.getElementById("product-count");

  (async () => {
    const { categories } = await WISEUP.getJSON("/api/categories");
    const cat = categories.find((c) => c.id === id);
    if (!cat) {
      heading.textContent = WISEUP.lang() === "en" ? "Category not found" : "الفئة غير موجودة";
      return;
    }
    heading.textContent = WISEUP.lang() === "en" ? cat.name_en : cat.name_ar;
    const { products } = await WISEUP.getJSON(`/api/products?category_id=${id}`);
    count.textContent = products.length;
    grid.innerHTML = products.map(WISEUP.productCard).join("");
  })();
</script>
```

The markup must provide `#category-name`, `#product-count`, and `#product-grid`.

- [ ] **Step 3: Verify both pages in a browser**

With the server running, open:
- http://127.0.0.1:8001/catalog — 632 cards; the filter narrows them; search works in
  Arabic and English; the page reads right-to-left.
- http://127.0.0.1:8001/category?id=5 — only that series' products; the count matches.
- http://127.0.0.1:8001/category?id=999 — "Category not found", no crash.

- [ ] **Step 4: Commit**

```bash
git add frontend/catalog.html frontend/category.html
git commit -m "feat: catalog and category pages wired to the API"
```

---

### Task 12: Product detail page, landing page, and chat widget

**Files:**
- Create: `frontend/product.html` (adapted from `frontend/stitch/product.html`)
- Modify: `frontend/index.html` (adapted from `frontend/stitch/index.html`)
- Test: `tests/test_store_api.py`

**Interfaces:**
- Consumes: `window.WISEUP` (Task 10); `/api/products/{code}`, `/api/categories`,
  `/api/products?category_id=` (Task 8); the existing `POST /ask` (`api.py:55`, body
  `{query, session_id}` → `{answer, products}`).
- Produces: `/product?code=<code>` renders; `/` is the new landing page; the chat widget
  works on every page.

**The chat widget already exists** in the current `frontend/index.html` — it has `esc()`,
`safeUrl()`, `card()`, `stripMarkdown()` and `linkifyCodes()` and it talks to `/ask`.
Carry that code across into the new Stitch landing page rather than rewriting it. The
request field is `query`, **not** `question`.

- [ ] **Step 1: Build `frontend/product.html`**

```html
<script src="/static/store.js"></script>
<script>
  WISEUP.applyDir();
  const code = new URLSearchParams(location.search).get("code");
  const root = document.getElementById("product-root");
  const related = document.getElementById("related-grid");

  (async () => {
    let p;
    try {
      p = await WISEUP.getJSON(`/api/products/${encodeURIComponent(code)}`);
    } catch (e) {
      root.innerHTML = `<p class="text-center text-gray-500 py-16">${
        WISEUP.lang() === "en" ? "Product not found" : "المنتج غير موجود"}</p>`;
      return;
    }
    const price = WISEUP.money(p);
    document.title = `${WISEUP.t(p)} — WISEUP`;
    root.innerHTML = `
      <div class="grid md:grid-cols-2 gap-8">
        <img src="${WISEUP.esc(p.image_url)}" alt="${WISEUP.esc(WISEUP.t(p))}"
             class="w-full object-contain bg-white rounded border p-6"
             onerror="this.style.visibility='hidden'">
        <div>
          <h1 class="font-headline text-3xl mb-2">${WISEUP.esc(WISEUP.t(p))}</h1>
          <p class="text-gray-500 mb-4">${WISEUP.esc(p.name_en)} · ${WISEUP.esc(p.name_ar)}</p>
          <dl class="text-sm space-y-1 mb-6">
            <div><dt class="inline text-gray-500">${
              WISEUP.lang() === "en" ? "Code" : "الكود"}:</dt>
                <dd class="inline font-mono">${WISEUP.esc(p.code)}</dd></div>
            <div><dt class="inline text-gray-500">${
              WISEUP.lang() === "en" ? "Unit" : "الوحدة"}:</dt>
                <dd class="inline">${WISEUP.esc(p.unit)}</dd></div>
          </dl>
          ${price ? `<div class="text-brand font-bold text-3xl mb-6">${
            WISEUP.esc(price)}</div>` : ""}
          <div class="flex gap-3 items-center">
            <input id="qty" type="number" min="1" value="1"
                   class="w-20 border rounded px-3 py-2">
            <button id="add" class="bg-brand text-white px-6 py-2 rounded font-semibold">
              ${WISEUP.lang() === "en" ? "Add to cart" : "أضف إلى السلة"}
            </button>
          </div>
        </div>
      </div>`;
    // Phase 4 owns the cart. Until then the button is honest about doing nothing.
    document.getElementById("add").addEventListener("click", () => {
      alert(WISEUP.lang() === "en"
        ? "Ordering opens soon — call us to place an order."
        : "الطلب سيتوفر قريباً — اتصل بنا لإتمام الطلب.");
    });
    const { products } = await WISEUP.getJSON(`/api/products?category_id=${p.category_id}`);
    related.innerHTML = products.filter((x) => x.code !== p.code)
      .slice(0, 6).map(WISEUP.productCard).join("");
  })();
</script>
```

The markup must provide `#product-root` and `#related-grid`.

- [ ] **Step 2: Build `frontend/index.html`**

Start from `frontend/stitch/index.html`. Then:

1. Copy the chat-widget markup and its `<script>` across from the **current**
   `frontend/index.html` (retrieve it with `git show HEAD:frontend/index.html` if you have
   already overwritten it). Keep `/ask` and the `query` field name intact.
2. Add `<script src="/static/store.js"></script>` and call `WISEUP.applyDir()`.
3. Fill the category grid from the API:

```html
<script>
  (async () => {
    const { categories } = await WISEUP.getJSON("/api/categories");
    document.getElementById("category-grid").innerHTML = categories.map((c) => `
      <a href="/category?id=${c.id}"
         class="block rounded border p-4 text-center hover:shadow-lg transition bg-white">
        <div class="font-semibold">${WISEUP.esc(
          WISEUP.lang() === "en" ? c.name_en : c.name_ar)}</div>
        <div class="text-xs text-gray-500 mt-1">${c.count}</div>
      </a>`).join("");
  })();
</script>
```

4. Wire the AR/EN toggle to `WISEUP.setLang`.

- [ ] **Step 3: Run the full API test suite — all of it should now pass**

Run: `python -m pytest tests/test_store_api.py -v`
Expected: PASS (6 tests). `test_storefront_pages_are_served` passes now that all four HTML
files exist.

- [ ] **Step 4: Run the whole suite**

Run: `python -m pytest -q`
Expected: all pass, 1 skipped.

- [ ] **Step 5: Walk the site by hand**

With the server running at http://127.0.0.1:8001 :

- `/` — hero, 26 category cards with counts, chat widget opens and answers «عندك مفكات؟»
  with product cards.
- Click a category card → `/category?id=N` shows that series.
- Click a product → `/product?code=X` shows the detail page and related products.
- `/product?code=99999` → "Product not found", no crash.
- Toggle EN → names switch to English, direction flips to LTR, the choice survives a reload.
- Toggle AR → back to Arabic, RTL.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/product.html
git commit -m "feat: product detail page and Stitch landing page with chat widget"
```

---

## Done means

- `python -m pytest -q` passes (1 skipped).
- `products.json` holds exactly 632 products with unique codes, each with a non-empty
  `name_en` and a `category_id` pointing at a real crawled category; no product lost `code`,
  `price_jod`, `unit`, `name_ar`, or `image`.
- `rag.hybrid_retrieve("pliers")` returns products — the index is bilingual.
- `/`, `/catalog`, `/category?id=N`, `/product?code=X` all render; unknown ids and codes
  degrade to a message rather than a crash.
- Every product JSON in every response came out of `catalog.serialize_product()`.
- The owner has reviewed the Arabic category names (Task 2), a sample of the English
  product names (Task 3), and the category distribution (Task 4). **All three gates passed
  on 2026-07-15**, with these owner decisions applied:
  - id 5 → `سلسلة الزراديات` (not `الكماشة` — that word appears in 0 products)
  - id 18 → `مستلزمات السلامة` (the site's "Labor Insurance" is a bad translation of 劳保/PPE)
  - id 22 "Cutting and polishing" merged into id 8 "Polishing series" and dropped → **26 categories**
  - the imageless duplicate `81103` row deleted → **632 products, unique codes**
  - explicitly left alone: ids 10 vs 11 read near-identically in Arabic; the
    cutting/shearing overlap between ids 14 and 23.

## Known follow-ups (not in this plan)

- **`data/wiseup_prices.xlsx` still contains the duplicate `81103` row**, and it still lacks
  any `name_en`/`category_id` column. `ingest_excel.py` rebuilds `products.json` from that
  spreadsheet with only `code`, `name_ar`, `unit`, `price_jod`, `image` — so the next price
  update run **silently wipes every English name and category and reintroduces the duplicate**.
  The enrichment artifacts in `data/` make this cheap to repair (both scripts skip cached
  work, so only genuinely new products cost an LLM call), but the chain has to be wired up
  and `ingest_excel.py` has to stop being safe to run alone. Raised with the owner
  2026-07-15; deferred, not resolved.

## Deliberately not in this plan

Per the spec's Non-Goals and phasing: no Firebase, no login, no roles, no price omission in
practice, no cart, no orders, no RFQ, no payment. Phase 3 turns `include_price=False` on in
`catalog.py`; Phase 4 builds the cart. Both get their own spec.
