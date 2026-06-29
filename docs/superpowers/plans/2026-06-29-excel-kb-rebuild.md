# Excel KB Rebuild + Repo Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the KB with the client's Excel price list (Arabic, JOD-priced, embedded images), rebuild the index/cards/prompt around the new schema, and delete all old-catalog files for a clean repo.

**Architecture:** New `ingest_excel.py` turns `data/wiseup_prices.xlsx` into `products.json` + extracted `images/<code>.png`; `build_index.py` rebuilds the Chroma index; `rag.py`/`tools.py`/`agent_graph.py`/`api.py`/`frontend` move from the old `item_no/series/size` schema to `code/name_ar/price_jod`; a final task deletes old files.

**Tech Stack:** Python 3.14, openpyxl, LangGraph, langchain-chroma, OpenAI embeddings, FastAPI, pytest, vanilla JS. Windows / PowerShell. Branch `feature/excel-kb-rebuild`.

## Global Constraints

- Branch `feature/excel-kb-rebuild` (already checked out off `master`).
- New product schema: `{ "code": str, "name_ar": str, "unit": str, "price_jod": float, "image": "images/<code>.png" | "" }`.
- Source Excel lives at `data/wiseup_prices.xlsx` (moved from `new products/10_اسعار  الوسب -.xlsx`); columns A الرقم, B الصورة, C الكود, D الصنف, E Unit, F السعر.
- Product images come from the embedded pictures in the `الصورة` column; extract to `images/<code>.png`.
- Prices are **JOD**; the agent quotes prices; replies stay card-aligned (short intro, no markdown asterisks/lists).
- Arabic-only KB — NO bilingual EN/AR pipeline. Embeddings: OpenAI `text-embedding-3-small` via `rag.get_embeddings()`; index at `rag.store_config()` (`./chroma_db_openai`).
- Secrets only via `.env` (`OPENAI_API_KEY` etc.); never commit real secrets (tests use dummies).
- Each task ends with `python -m pytest -q` green (live index/embedding steps load `.env`).

---

## File Structure

| File | Change |
|---|---|
| `data/wiseup_prices.xlsx` | the source Excel (moved here) |
| `ingest_excel.py` (new) | Excel → `products.json` + `images/<code>.png` |
| `build_index.py` (rewrite) | `products.json` → Chroma (new schema, no bilingual) |
| `rag.py` (modify) | `retrieve` (drop dedup/series), `build_context` (Arabic + price) |
| `tools.py` (modify) | `_BY_ITEM` by `code`, `to_card` new fields, `retrieve_products` drop `series`, `email_owner`/`_format_email` price + total |
| `agent_graph.py` (modify) | `SYSTEM_PROMPT` JOD/price wording |
| `api.py` (modify) | remove `/series`, `SERIES`, `series` param |
| `frontend/index.html` (modify) | card fields + price + remove series filter |
| `tests/*` | updated for new schema; `tests/test_ingest.py` new |
| Part 8 delete list | old-catalog files removed |

---

## Task 1: Ingestion — Excel → products.json + images

**Files:**
- Move: `new products/10_اسعار  الوسب -.xlsx` → `data/wiseup_prices.xlsx`
- Create: `ingest_excel.py`, `tests/test_ingest.py`
- Modify: `tools.py` (one line: `_BY_ITEM`), `tests/test_tool_helpers.py` (lookup test)

**Interfaces:**
- Produces: `is_product(name, price) -> bool`; `ingest_excel.main()` writing `products.json` (new schema) and `images/<code>.png`.

- [ ] **Step 1: Move the Excel into `data/`**

```bash
mkdir -p data
git mv "new products/10_اسعار  الوسب -.xlsx" data/wiseup_prices.xlsx
rmdir "new products" 2>/dev/null || true
```

- [ ] **Step 2: Write the failing test** `tests/test_ingest.py`

```python
import ingest_excel as ing


def test_is_product_accepts_real_row():
    assert ing.is_product("زرادية كهرباء صناعي 6\"", 2.5) is True


def test_is_product_rejects_header_and_blanks():
    assert ing.is_product("الصنف", "السعر") is False   # header: price not numeric
    assert ing.is_product("", 2.5) is False             # no name
    assert ing.is_product("x", None) is False           # no price
```

- [ ] **Step 3: Run it to verify it fails**

Run: `python -m pytest tests/test_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'ingest_excel'`.

- [ ] **Step 4: Write `ingest_excel.py`**

```python
"""Turn the WISEUP Excel price list into products.json + extracted product images.

Source: data/wiseup_prices.xlsx (cols: A الرقم, B الصورة, C الكود, D الصنف, E Unit, F السعر).
Images are embedded in the الصورة column; we extract each to images/<code>.png.
"""
import json
import os
import shutil
import openpyxl

SRC = "data/wiseup_prices.xlsx"
IMG_DIR = "images"
OUT = "products.json"


def is_product(name, price) -> bool:
    """A data row is a product when it has a non-empty name and a numeric price.
    This filters out the header row (price == 'السعر') and blank/separator rows."""
    return bool(name and str(name).strip()) and isinstance(price, (int, float))


def main():
    wb = openpyxl.load_workbook(SRC)  # NOT read_only, so embedded images load
    ws = wb["Sheet1"]
    products = []
    row_code = {}  # 1-based sheet row -> code
    for row in ws.iter_rows(min_row=2):
        code, name, unit, price = row[2].value, row[3].value, row[4].value, row[5].value
        if not is_product(name, price):
            continue
        code = str(code).strip()
        products.append({
            "code": code,
            "name_ar": str(name).strip(),
            "unit": str(unit).strip() if unit else "",
            "price_jod": float(price),
            "image": "",
        })
        row_code[row[0].row] = code

    if os.path.isdir(IMG_DIR):
        shutil.rmtree(IMG_DIR)
    os.makedirs(IMG_DIR, exist_ok=True)

    by_code = {p["code"]: p for p in products}
    saved = 0
    for img in getattr(ws, "_images", []):
        sheet_row = img.anchor._from.row + 1  # anchor row is 0-based
        code = row_code.get(sheet_row)
        if not code:
            continue
        p = by_code[code]
        if p["image"]:
            continue  # keep the first image per product
        with open(os.path.join(IMG_DIR, f"{code}.png"), "wb") as f:
            f.write(img._data())
        p["image"] = f"{IMG_DIR}/{code}.png"
        saved += 1

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    without = sum(1 for p in products if not p["image"])
    print(f"products: {len(products)}  images saved: {saved}  without image: {without}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python -m pytest tests/test_ingest.py -v`
Expected: PASS (2 passed).

- [ ] **Step 6: Run the real ingestion and sanity-check outputs**

Run:
```bash
python ingest_excel.py
python -c "import json; d=json.load(open('products.json',encoding='utf-8')); print('rows',len(d)); print(d[0]); import os; print('imgs', len([f for f in os.listdir('images') if f.endswith('.png')]))"
```
Expected: ~542 rows; first row has `code/name_ar/unit/price_jod/image`; a few hundred PNGs in `images/`. Spot-check one: confirm `images/10101.png` exists and is a real image (non-zero size).

- [ ] **Step 7: Keep the app importable under the new schema** — in `tools.py` change the `_BY_ITEM` line:

From:
```python
_BY_ITEM = {str(p["item_no"]): p for p in _PRODUCTS if p.get("item_no")}
```
To:
```python
_BY_ITEM = {str(p["code"]): p for p in _PRODUCTS if p.get("code")}
```

- [ ] **Step 8: Fix the lookup test** in `tests/test_tool_helpers.py` — replace the body of `test_lookup_products_returns_known_item` with:

```python
def test_lookup_products_returns_known_item():
    import json
    rows = json.load(open("products.json", encoding="utf-8"))
    code = str(rows[0]["code"])
    found = tools._lookup_products([code])
    assert found and str(found[0]["code"]) == code
```

- [ ] **Step 9: Run the full suite**

Run: `python -m pytest -q`
Expected: all pass (live test skips). `import tools` works against the new `products.json`.

- [ ] **Step 10: Commit**

```bash
git add data/wiseup_prices.xlsx ingest_excel.py products.json images tests/test_ingest.py tools.py tests/test_tool_helpers.py
git commit -m "feat: ingest Excel price list into products.json + extract product images"
```

---

## Task 2: Rebuild the index (build_index.py)

**Files:**
- Modify (rewrite): `build_index.py`
- Test: `tests/test_build_index.py` (new)

**Interfaces:**
- Consumes: `products.json`, `rag.store_config()`, `rag.get_embeddings()`
- Produces: `describe(p) -> str`, `clean_meta(p) -> dict`, `main()` building Chroma.

- [ ] **Step 1: Write the failing test** `tests/test_build_index.py`

```python
import build_index


def test_describe_includes_name_and_code():
    s = build_index.describe({"name_ar": "زرادية كهرباء", "code": "10101"})
    assert "زرادية كهرباء" in s and "10101" in s


def test_clean_meta_keeps_new_schema_keys():
    m = build_index.clean_meta({"code": "10101", "name_ar": "زرادية", "unit": "pcs",
                                "price_jod": 2.5, "image": "images/10101.png"})
    assert m == {"code": "10101", "name_ar": "زرادية", "unit": "pcs",
                 "price_jod": 2.5, "image": "images/10101.png"}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_build_index.py -v`
Expected: FAIL — old `build_index` has no `clean_meta`/`describe` of this shape (it references the bilingual schema).

- [ ] **Step 3: Rewrite `build_index.py`**

```python
"""Build the Chroma index from products.json (Arabic, priced schema)."""
import json
import os
import shutil
from langchain_chroma import Chroma
from langchain_core.documents import Document
import rag

PRODUCTS = "products.json"


def describe(p):
    return f"{p['name_ar']} (كود {p['code']})"


def clean_meta(p):
    return {
        "code": p.get("code", ""),
        "name_ar": p.get("name_ar", ""),
        "unit": p.get("unit", ""),
        "price_jod": p.get("price_jod", 0),
        "image": p.get("image", ""),
    }


def main():
    products = json.load(open(PRODUCTS, encoding="utf-8"))
    docs = [Document(page_content=describe(p), metadata=clean_meta(p)) for p in products]
    persist, collection = rag.store_config()
    embeddings = rag.get_embeddings()
    if os.path.isdir(persist):
        shutil.rmtree(persist)
    Chroma.from_documents(documents=docs, embedding=embeddings,
                          persist_directory=persist, collection_name=collection)
    print(f"indexed {len(docs)} products into {persist}/{collection}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_build_index.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Build the live index** (loads `.env` for OpenAI embeddings)

Run (PowerShell):
```powershell
foreach ($l in Get-Content .env) { if ($l -match '^(.*?)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }
python build_index.py
```
Expected: prints `indexed 542 products into ./chroma_db_openai/...` with no error.

- [ ] **Step 6: Run the full suite**

Run: `python -m pytest -q`
Expected: all pass (live test skips).

- [ ] **Step 7: Commit**

```bash
git add build_index.py tests/test_build_index.py
git commit -m "feat: rebuild Chroma index from Arabic priced products.json (drop bilingual)"
```

---

## Task 3: Retrieval + cards (rag.py + tools.py)

**Files:**
- Modify: `rag.py` (`retrieve`, `build_context`), `tools.py` (`to_card`, `retrieve_products`)
- Test: `tests/test_tool_helpers.py` (to_card), `tests/test_retrieve_tool.py`

**Interfaces:**
- Produces: `to_card(doc, score) -> {code, name_ar, price_jod, unit, image_url, relevance}`;
  `retrieve_products(query, tool_call_id) -> Command` (no `series`); `rag.retrieve(query, k=8)`.

- [ ] **Step 1: Update the failing tests** — replace `tests/test_tool_helpers.py` `test_to_card_*` with:

```python
def test_to_card_maps_new_schema_and_image():
    doc = Document(page_content="x", metadata={
        "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
        "price_jod": 2.5, "image": "images/10101.png"})
    card = tools.to_card(doc, 0.4)
    assert card["code"] == "10101"
    assert card["name_ar"].startswith("زرادية")
    assert card["price_jod"] == 2.5
    assert card["unit"] == "pcs"
    assert card["image_url"] == "/images/10101.png"
    assert 5 <= card["relevance"] <= 100
```
(Delete the old `test_to_card_maps_metadata_and_image`.)

And replace `tests/test_retrieve_tool.py` with:

```python
from langchain_core.documents import Document
from langgraph.types import Command
import tools


def test_retrieve_products_returns_command_with_cards(monkeypatch):
    doc = Document(page_content="زرادية", metadata={
        "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
        "price_jod": 2.5, "image": "images/10101.png"})
    monkeypatch.setattr(tools.rag, "retrieve", lambda q, k=8: [(doc, 0.4)])
    monkeypatch.setattr(tools.rag, "gate", lambda results: results)

    cmd = tools.retrieve_products.func(query="زرادية", tool_call_id="tc1")

    assert isinstance(cmd, Command)
    assert cmd.update["retrieved_products"][0]["code"] == "10101"
    assert cmd.update["retrieved_products"][0]["price_jod"] == 2.5
    msg = cmd.update["messages"][0]
    assert msg.tool_call_id == "tc1"
    assert "زرادية" in msg.content
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python -m pytest tests/test_tool_helpers.py tests/test_retrieve_tool.py -v`
Expected: FAIL — `to_card` still emits old keys; `retrieve_products` still requires `series`.

- [ ] **Step 3: Rewrite `to_card` in `tools.py`**

```python
def to_card(doc, score):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "code": m.get("code", ""),
        "name_ar": m.get("name_ar", ""),
        "price_jod": m.get("price_jod", 0),
        "unit": m.get("unit", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        "relevance": max(5, min(100, round((1 - score / 2) * 100))),
    }
```

- [ ] **Step 4: Update `retrieve_products` in `tools.py`** — drop the `series` parameter:

```python
@tool
def retrieve_products(query: str,
                      tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Search the WISEUP Arabic product catalog (with JOD prices) for tools matching the
    query. Use for any question about specific products, prices, or codes."""
    log(f"🔧 TOOL retrieve_products(query={query!r})")
    results = rag.gate(rag.retrieve(query, k=8))
    cards = [to_card(d, s) for d, s in results]
    log(f"🔧 TOOL retrieve_products → found {len(cards)} product(s)")
    summary = rag.build_context(results) or "No matching products found."
    return Command(update={
        "retrieved_products": cards,
        "messages": [ToolMessage(summary, tool_call_id=tool_call_id)],
    })
```

- [ ] **Step 5: Rewrite `retrieve` and `build_context` in `rag.py`**

Replace `retrieve`:
```python
def retrieve(query, k=8):
    return get_store().similarity_search_with_score(query, k=k)
```
Replace `build_context`:
```python
def build_context(results):
    lines = []
    for doc, _ in results:
        m = doc.metadata
        lines.append(
            f"- {m.get('name_ar','')} | السعر: {m.get('price_jod','')} JOD | "
            f"الوحدة: {m.get('unit','')} | كود: {m.get('code','')}")
    return "\n".join(lines)
```
(Leave `gate`, `RELEVANCE_THRESHOLD`, `store_config`, `get_embeddings`, `get_store` unchanged.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_tool_helpers.py tests/test_retrieve_tool.py -v`
Expected: PASS.

- [ ] **Step 7: Full suite**

Run: `python -m pytest -q`
Expected: all pass (live test skips).

- [ ] **Step 8: Commit**

```bash
git add rag.py tools.py tests/test_tool_helpers.py tests/test_retrieve_tool.py
git commit -m "feat: retrieval + cards use Arabic name/code/JOD price schema"
```

---

## Task 4: Email lead with prices (tools.py)

**Files:**
- Modify: `tools.py` (`_format_email`, `email_owner`)
- Test: `tests/test_email_tool.py`

**Interfaces:**
- Produces: `_format_email(products, customer_name, customer_phone, customer_email, customer_message)` listing each product with `price_jod` and a total; `email_owner` unchanged signature.

- [ ] **Step 1: Update the happy-path test** in `tests/test_email_tool.py` — change the `_lookup_products` stub and assertions in `test_email_owner_happy_path` to the new schema + price/total:

```python
def test_email_owner_happy_path(monkeypatch):
    sent = {}
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "test-pass")
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", _fake_smtp(sent))
    monkeypatch.setattr(tools, "_lookup_products",
        lambda ids: [{"code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"",
                      "unit": "pcs", "price_jod": 2.5}])
    result = tools.email_owner.func(
        item_nos=["10101"], customer_name="Omar",
        customer_phone="0790000000", customer_email="o@x.com",
        customer_message="بدي هاي")
    assert "Sent 1" in result
    assert sent["login"] == (tools.OWNER_EMAIL, "test-pass")
    b = sent["body"]
    assert "Omar" in b and "0790000000" in b and "o@x.com" in b
    assert "10101" in b and "زرادية" in b
    assert "2.5" in b and "JOD" in b          # price shown
    assert "Total" in b                        # total line present
```
Leave the other three tests (`missing_contact`, `single_item`, `unknown_items`) as-is except update their `_lookup_products` stubs that build products to use the new keys (`code`, `name_ar`, `price_jod`) where present; the single-item test should assert `sent["body"].count("كود:") == 1` or keep `count("10101")`—use:
```python
    assert sent["body"].count("10101") == 1
```
in `test_email_owner_single_item` (and its stub returns one product with `code`/`name_ar`/`price_jod`).

- [ ] **Step 2: Run them to verify they fail**

Run: `python -m pytest tests/test_email_tool.py -v`
Expected: FAIL — body has no price/JOD/total and `_format_email` uses old keys.

- [ ] **Step 3: Rewrite `_format_email` in `tools.py`**

```python
def _format_email(products, customer_name, customer_phone, customer_email, customer_message) -> str:
    lines = [
        "New customer lead",
        f"Name:  {customer_name}",
        f"Phone: {customer_phone or '—'}",
        f"Email: {customer_email or '—'}",
        "",
        f"Interested in ({len(products)} product(s)):",
    ]
    total = 0.0
    for p in products:
        price = p.get("price_jod", 0) or 0
        total += float(price)
        lines.append(
            f"- {p.get('name_ar','')} | كود: {p.get('code','')} | "
            f"الوحدة: {p.get('unit','')} | السعر: {price} JOD")
    lines += ["", f"Total: {round(total, 2)} JOD", "", f"Message: {customer_message or '(none)'}"]
    return "\n".join(lines)
```
(`email_owner` itself is unchanged — it already calls `_format_email(products, customer_name, customer_phone, customer_email, customer_message)` and builds the Subject from `len(products)`/`customer_name`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_email_tool.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Full suite**

Run: `python -m pytest -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tools.py tests/test_email_tool.py
git commit -m "feat: owner lead email lists JOD prices and a total"
```

---

## Task 5: System prompt — Arabic, JOD prices (agent_graph.py)

**Files:**
- Modify: `agent_graph.py` (`SYSTEM_PROMPT`)
- Test: `tests/test_system_prompt.py`

**Interfaces:**
- Produces: `SYSTEM_PROMPT` mentioning JOD prices, keeping card + lead rules.

- [ ] **Step 1: Add a failing assertion** — append to `tests/test_system_prompt.py`:

```python
def test_system_prompt_mentions_jod_prices():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "jod" in p or "price" in p
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_system_prompt.py -v`
Expected: FAIL — current prompt has no price/JOD wording.

- [ ] **Step 3: Replace `SYSTEM_PROMPT` in `agent_graph.py`**

```python
SYSTEM_PROMPT = """You are the WISEUP tools catalog assistant, a friendly B2B assistant \
for a hand-tools and power-tools brand. The catalog is in Arabic and every product has a \
price in Jordanian dinars (JOD).

Tools you can use:
- retrieve_products: search the local Arabic product catalog (names, codes, prices). Use for \
any question about specific tools, what is available, or how much something costs.
- search_wiseup_web: search the official WISEUP website (wiseuptools.com). Use ONLY for \
company/website info that is NOT in the catalog.
- email_owner: send the customer's selected products and their contact details to the \
business owner as a lead.

Replying with products (IMPORTANT):
- When retrieve_products returns products, the user interface already shows them as visual \
cards (image, Arabic name, code, and price in JOD). Write only a SHORT, friendly intro of \
1-2 sentences that points to the cards below. You may mention prices in JOD when helpful.
- Do NOT list each product in your text. Do NOT use markdown bold or asterisks (**), and do \
NOT output numbered or bulleted product lists. The cards carry the details; your text only \
frames them.

Collecting an order / lead:
- When the customer signals they are finished or ready to proceed/order, FIRST ask them in a \
single message for their name, phone number, and email. You need their name and at least one \
of phone or email.
- Once you have valid contact details, ask them to confirm: "Shall I send these N products to \
the owner?" Only call email_owner AFTER they reply yes, passing the product codes discussed \
plus the collected name, phone, and email.

General:
- Never invent codes, products, prices, or contact details.
- Prices are in JOD. Keep replies concise and friendly; reply in the customer's language."""
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_system_prompt.py -v`
Expected: PASS.

- [ ] **Step 5: Full suite**

Run: `python -m pytest -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add agent_graph.py tests/test_system_prompt.py
git commit -m "feat: system prompt for Arabic catalog with JOD prices"
```

---

## Task 6: API — drop /series (api.py)

**Files:**
- Modify: `api.py`
- Test: `tests/test_api.py`

**Interfaces:**
- Produces: `/ask` returns `{answer, products}`; `/series` removed; `AskReq` has no `series`.

- [ ] **Step 1: Add a failing test** — append to `tests/test_api.py`:

```python
def test_series_route_removed():
    from fastapi.testclient import TestClient
    client = TestClient(api.app)
    assert client.get("/series").status_code == 404
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_api.py::test_series_route_removed -v`
Expected: FAIL — `/series` still returns 200.

- [ ] **Step 3: Edit `api.py`** — remove the series machinery:
  - Delete the `SERIES = sorted(...)` line and change the products load to just `_products = json.load(open("products.json", encoding="utf-8"))` (keep it only if used for a stat; otherwise remove).
  - Delete the entire `@app.get("/series")` route and its `series()` function.
  - In `class AskReq`, delete the `series: Optional[list[str]] = None` field.
  - The `/ask` body already calls `graph.invoke({"messages": [HumanMessage(req.query)], "session_id": thread}, config)` — it does NOT pass `series`, so no change there. Remove `req.series` from `log_interaction(...)` if present (pass `None` or drop the arg) — keep `log_interaction`'s call consistent with its definition.

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_api.py -v`
Expected: PASS (existing `test_ask_returns_answer_and_products` still passes; new 404 test passes).

- [ ] **Step 5: Full suite + import check**

Run: `python -m pytest -q` then `python -c "import api"`
Expected: all pass; `import api` clean.

- [ ] **Step 6: Commit**

```bash
git add api.py tests/test_api.py
git commit -m "feat: drop /series route and series param (no series in new KB)"
```

---

## Task 7: Frontend — price cards, remove series filter (frontend/index.html)

**Files:**
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: `/ask` response `products[]` with `{code, name_ar, price_jod, unit, image_url, relevance}`.

- [ ] **Step 1: Replace the `card(p, i)` function** with one that renders the new fields (image, Arabic name RTL, code, price in JOD, unit). Read the current `card(p, i)` in `frontend/index.html` (starts ~line 167) and replace its whole body with:

```js
function card(p, i){
  const img = p.image_url
    ? `<img src="${p.image_url}" alt="${p.name_ar}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" onerror="this.parentElement.innerHTML='<span class=\\'material-symbols-outlined text-gray-400 text-6xl\\'>build</span>'"/>`
    : `<span class="material-symbols-outlined text-gray-400 text-6xl">build</span>`;
  return `
  <article class="card-in bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col group hover:shadow-md transition-shadow relative" style="animation-delay:${i*40}ms">
    <div class="aspect-square bg-gray-50 flex items-center justify-center p-4">${img}</div>
    <div class="p-3 flex flex-col gap-2" dir="rtl">
      <h3 class="text-sm font-medium leading-snug">${p.name_ar || 'منتج'}</h3>
      <div class="flex items-center justify-between">
        <span class="text-base font-bold text-brand">${p.price_jod} JOD</span>
        <span class="text-xs text-text-muted">${p.unit || ''}</span>
      </div>
      <span class="text-xs text-text-muted font-mono" dir="ltr">كود: ${p.code}</span>
    </div>
  </article>`;
}
```

- [ ] **Step 2: Remove the series filter.** In `frontend/index.html`:
  - Delete the series sidebar render block (the code that does `fetch('/series')` and builds the `.series-cb` checkboxes — around lines 150-163) and the `selectedSeries` set.
  - In the `/ask` request body, remove any `series: [...selectedSeries]` field so it sends only `{ query, session_id }` (plus `k` if present).
  - Remove the series count from the header stat (the `#stat-series` element / its text update); leave the product-count stat.

- [ ] **Step 3: Verify no leftover series references**

Run: `grep -n "series\|/series\|selectedSeries\|stat-series" frontend/index.html` (Bash) — expect no functional references remain (only possibly an unused CSS class is fine; remove JS references).

- [ ] **Step 4: Manual browser check.** Start the server (loads `.env`), open http://127.0.0.1:8000, ask `زرادية كهرباء`.

Run (PowerShell):
```powershell
foreach ($l in Get-Content .env) { if ($l -match '^(.*?)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```
Expected: cards show the **product image, Arabic name (RTL), code, and price in JOD**; no series sidebar; the answer text is a short intro.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html
git commit -m "feat: product cards show Arabic name + JOD price + image; remove series filter"
```

---

## Task 8: Repo cleanup — delete old-catalog files

**Files:**
- Delete: the Part 10 list from the spec.

- [ ] **Step 1: Confirm `memory.py` is not imported anywhere**

Run: `grep -rn "import memory\b\|from memory " --include=*.py . || echo "memory not imported"`
Expected: `memory not imported` (if anything prints, stop and report).

- [ ] **Step 2: Delete the old-catalog files**

```bash
git rm -r --quiet \
  "WISEUP 2025 New Product Catalog.pdf" \
  _aggregate.py _extract.py _extract_v2.py _ocr_all.py _ocr_headers.py \
  _e.png _t.png _hdr_tmp.png _logohdr.png _ocr_tmp.png \
  _extract2.log _extract_progress.log _hdr_progress.log _ocr_progress.log \
  _headers.json _ocr_codes.json _series_items.json _pages \
  apply_ar.py translate_kb.py kb_ar_glossary.json products_bilingual.json \
  products.csv app.py memory.py \
  frontend/_skeleton.html frontend/_stitch_screenshot.png frontend/wiseup_stitch.html
```
(If any path is already gone, remove it from the command and re-run.)

- [ ] **Step 3: Confirm the app still imports and tests pass**

Run:
```bash
python -c "import api, agent_graph, tools, rag, build_index, ingest_excel"
python -m pytest -q
```
Expected: clean import; all pass (live test skips).

- [ ] **Step 4: Live end-to-end check** (loads `.env`)

Run (PowerShell):
```powershell
foreach ($l in Get-Content .env) { if ($l -match '^(.*?)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }
$env:RUN_LIVE=1; python -m pytest tests/test_smoke_live.py -q
```
If the live smoke test references old query text, update it to an Arabic query (`زرادية كهرباء`) and assert products returned. Expected: PASS (real OpenAI + Chroma return products).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old catalog, OCR scratch, bilingual pipeline, and dead UI files"
```

---

## Self-Review Notes

- **Spec coverage:** ingestion + image extraction (Task 1) ✓; move xlsx (Task 1) ✓; index rebuild / drop bilingual (Task 2) ✓; retrieval + cards new schema (Task 3) ✓; email price + total (Task 4) ✓; prompt JOD (Task 5) ✓; drop /series (Task 6) ✓; frontend price cards + remove series (Task 7) ✓; cleanup deletions (Task 8) ✓; tests updated across tasks + `test_ingest` (Task 1) ✓.
- **Schema-flip safety:** Task 1 regenerates `products.json` AND flips `_BY_ITEM` to `code` + fixes the one lookup test, so `import tools` and the suite stay green; `to_card`/`_format_email` emit keys from supplied metadata so their mocked tests stay green until intentionally updated in Tasks 3-4.
- **Type consistency:** card keys `{code, name_ar, price_jod, unit, image_url, relevance}` consistent across Task 3 code + tests + Task 7 frontend; `retrieve(query, k=8)` and `retrieve_products(query, tool_call_id)` consistent across Tasks 3; `_format_email(products, customer_name, customer_phone, customer_email, customer_message)` unchanged signature in Task 4.
- **No placeholders / no real secrets** (tests use `test-pass`/`p`; live steps load `.env`).
