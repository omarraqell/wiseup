# Live Website Crawl (`browse_wiseup_website`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `search_wiseup_web` with `browse_wiseup_website(query)` — a Tavily-crawl tool that crawls wiseuptools.com live, extracts best-effort structured products with images via an LLM pass, and returns them as cards + a short text summary.

**Architecture:** New helpers in `tools.py` (lazy `TavilyCrawl` singleton, an injectable LLM getter, an extraction function, a web-card builder) back a `@tool` that returns a `Command` updating `retrieved_products` (like `retrieve_products`). The `_format_tavily` crash is fixed first. The prompt is re-scoped to catalog-first, and the frontend card gets two small guards for web-cards.

**Tech Stack:** Python, `langchain_tavily.TavilyCrawl`, `langchain_openai.ChatOpenAI` (gpt-4o-mini), LangGraph `Command`/`ToolMessage`, pytest, vanilla JS (frontend).

## Global Constraints

- Tests MUST be network-free: monkeypatch `tools._get_crawler`, `tools._web_llm`, and/or `tools._extract_web_products`; never hit Tavily/OpenAI in a test.
- Seed URL: `SITE_URL = os.environ.get("WISEUP_SITE_URL", "https://www.wiseuptools.com/h-col-103.html")` (the product category index).
- Crawl params (verbatim): `{"url": SITE_URL, "instructions": query, "include_images": True, "extract_depth": "advanced", "format": "markdown", "max_depth": 2, "limit": 15}`.
- Web-card shape: `{"code": "", "name_ar": <name>, "price_jod": <price or None>, "unit": "", "image_url": <absolute url>, "source_url": <url>, "relevance": int}`.
- `browse_wiseup_website` returns a `Command`. On products found: update `retrieved_products` + a `ToolMessage`. On nothing/exception: a `ToolMessage` only, with **no** `retrieved_products` key (don't wipe existing cards).
- `TOOLS` must end as `[retrieve_products, browse_wiseup_website, email_owner]` (no `search_wiseup_web`).
- Run tests with `python -m pytest -q` (Windows; a Bash tool is available). Files contain Arabic — use the Write/Edit tools, never type Arabic through PowerShell.

---

### Task 1: Fix the `_format_tavily` crash

Make `_format_tavily` handle the plain-string ("no results") and empty cases Tavily can return, instead of iterating a string's characters and calling `.get` on them.

**Files:**
- Modify: `tools.py` (`_format_tavily`, lines ~61-68)
- Test: `tests/test_format_tavily.py` (new)

**Interfaces:**
- Produces: `tools._format_tavily(res) -> str` accepting `dict | list | str | None`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_format_tavily.py`:
```python
import tools


def test_format_tavily_dict_with_results():
    res = {"results": [{"title": "About", "url": "https://x/a", "content": "hi"}]}
    out = tools._format_tavily(res)
    assert "About" in out and "https://x/a" in out and "hi" in out


def test_format_tavily_plain_string_does_not_crash():
    # Tavily returns a bare string when it finds nothing — must not raise.
    out = tools._format_tavily("No search results found for 'xyz'")
    assert "No search results found for 'xyz'" in out


def test_format_tavily_empty_and_none():
    assert "No results" in tools._format_tavily({})
    assert "No results" in tools._format_tavily([])
    assert "No results" in tools._format_tavily(None)
    assert "No results" in tools._format_tavily("")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_format_tavily.py -q`
Expected: FAIL — `test_format_tavily_plain_string_does_not_crash` raises `AttributeError: 'str' object has no attribute 'get'`.

- [ ] **Step 3: Implement the fix in `tools.py`**

Replace the `_format_tavily` function body:
```python
def _format_tavily(res) -> str:
    if isinstance(res, str):
        return res.strip() or "No results found on the WISEUP website."
    items = res.get("results", []) if isinstance(res, dict) else (res or [])
    if not items:
        return "No results found on the WISEUP website."
    lines = []
    for r in items:
        lines.append(f"- {r.get('title','')} ({r.get('url','')})\n  {r.get('content','')}")
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_format_tavily.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Run the full suite (must stay green)**

Run: `python -m pytest -q`
Expected: PASS (the existing `tests/test_web_tool.py` still passes — `search_wiseup_web` is untouched).

- [ ] **Step 6: Commit**

```bash
git add tools.py tests/test_format_tavily.py
git commit -m "fix: _format_tavily handles Tavily string/empty responses (no crash)"
```

---

### Task 2: Web extraction + card builder + config

Add the structuring helpers: a config seed URL, an injectable LLM getter, an image collector, a JSON-fence stripper, the extraction function, and the web-card builder. Does NOT add the tool or touch `TavilyCrawl`/`TOOLS` yet — suite stays green.

**Files:**
- Modify: `tools.py` (imports; add `SITE_URL`, `_web_llm`, `_collect_images`, `_strip_fences`, `_WEB_EXTRACT_SYS`, `_extract_web_products`, `to_web_card`)
- Test: `tests/test_web_crawl.py` (new)

**Interfaces:**
- Consumes: `tools._format_tavily`, `tools._rank_relevance` (existing).
- Produces:
  - `tools.SITE_URL: str`
  - `tools._web_llm()` → a chat model with `.invoke(messages).content`
  - `tools._collect_images(res) -> list[str]`
  - `tools._strip_fences(s: str) -> str`
  - `tools._extract_web_products(res, query: str) -> list[dict]` (records `{name, price, image_url, source_url}`; `[]` on any failure or non-dict `res`)
  - `tools.to_web_card(rec: dict, relevance: int) -> dict`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_web_crawl.py`:
```python
import tools


class _FakeLLM:
    def __init__(self, content):
        self._content = content
    def invoke(self, messages):
        class R:  # minimal .content carrier
            pass
        r = R()
        r.content = self._content
        return r


def test_collect_images_gathers_top_and_per_result():
    res = {"images": ["https://x/a.png"],
           "results": [{"images": ["https://x/b.png"]}, {"url": "https://x/c"}]}
    imgs = tools._collect_images(res)
    assert "https://x/a.png" in imgs and "https://x/b.png" in imgs


def test_strip_fences_unwraps_json_block():
    assert tools._strip_fences('```json\n[1,2]\n```') == "[1,2]"
    assert tools._strip_fences('[1,2]') == "[1,2]"


def test_extract_web_products_parses_llm_json(monkeypatch):
    monkeypatch.setattr(tools, "_web_llm", lambda: _FakeLLM(
        '[{"name":"Screwdriver","price":1.5,"image_url":"https://x/s.png","source_url":"https://x/p"}]'))
    res = {"results": [{"url": "https://x/p", "raw_content": "screwdriver",
                        "images": ["https://x/s.png"]}]}
    recs = tools._extract_web_products(res, "screwdriver")
    assert recs == [{"name": "Screwdriver", "price": 1.5,
                     "image_url": "https://x/s.png", "source_url": "https://x/p"}]


def test_extract_web_products_bad_json_returns_empty(monkeypatch):
    monkeypatch.setattr(tools, "_web_llm", lambda: _FakeLLM("not json at all"))
    res = {"results": [{"url": "https://x/p", "raw_content": "x"}]}
    assert tools._extract_web_products(res, "q") == []


def test_extract_web_products_string_or_empty_res_returns_empty():
    assert tools._extract_web_products("No search results found", "q") == []
    assert tools._extract_web_products(None, "q") == []


def test_to_web_card_maps_fields_and_missing_price():
    card = tools.to_web_card(
        {"name": "Pliers", "price": None, "image_url": "https://x/p.png",
         "source_url": "https://x/pl"}, 80)
    assert card["name_ar"] == "Pliers"
    assert card["price_jod"] is None
    assert card["image_url"] == "https://x/p.png"      # absolute, passthrough
    assert card["source_url"] == "https://x/pl"
    assert card["code"] == "" and card["unit"] == ""
    assert card["relevance"] == 80
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_web_crawl.py -q`
Expected: FAIL (`AttributeError: module 'tools' has no attribute '_collect_images'`).

- [ ] **Step 3: Implement in `tools.py`**

Add to the imports at the top (extend the existing messages import):
```python
from langchain_core.messages import ToolMessage, SystemMessage, HumanMessage
```
(remove the old `from langchain_core.messages import ToolMessage` line so it isn't duplicated).

Add after the `OWNER_EMAIL`/validation block (or anywhere after `_rank_relevance`), the config +
helpers (`json`, `os` are already imported at the top of `tools.py` — do NOT re-import them):
```python
SITE_URL = os.environ.get("WISEUP_SITE_URL", "https://www.wiseuptools.com/h-col-103.html")

_WEB_EXTRACT_SYS = (
    "You extract products from crawled web page content of a hand-tools store. "
    "Return ONLY a JSON array (no prose, no markdown) of objects with keys: "
    "name (string), price (number or null), image_url (absolute URL string or empty), "
    "source_url (absolute product URL string or empty). If there are no products, return []."
)


def _web_llm():
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", temperature=0)


def _collect_images(res) -> list:
    imgs = []
    if isinstance(res, dict):
        imgs += [u for u in res.get("images", []) or [] if isinstance(u, str)]
        for r in res.get("results", []) or []:
            if isinstance(r, dict):
                imgs += [u for u in r.get("images", []) or [] if isinstance(u, str)]
    return imgs


def _strip_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[-1] if "\n" in s else s[3:]
        s = s.rsplit("```", 1)[0]
    return s.strip()


def _extract_web_products(res, query: str) -> list:
    if not res or isinstance(res, str):
        return []
    images = _collect_images(res)
    raw = "\n\n".join(
        r.get("raw_content", "") for r in (res.get("results", []) or []) if isinstance(r, dict))
    text = raw or _format_tavily(res)   # prefer real page text; fall back to the summary
    human = (f"Query: {query}\n\nPage content:\n{text}\n\n"
             f"Image URLs found:\n" + "\n".join(images))
    try:
        raw = _web_llm().invoke(
            [SystemMessage(content=_WEB_EXTRACT_SYS), HumanMessage(content=human)]).content
        data = json.loads(_strip_fences(raw))
        return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else []
    except Exception:
        return []


def to_web_card(rec: dict, relevance: int) -> dict:
    return {
        "code": "",
        "name_ar": rec.get("name", "") or "",
        "price_jod": rec.get("price"),
        "unit": "",
        "image_url": rec.get("image_url", "") or "",
        "source_url": rec.get("source_url", "") or "",
        "relevance": int(relevance),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_web_crawl.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Run the full suite (must stay green)**

Run: `python -m pytest -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools.py tests/test_web_crawl.py
git commit -m "feat: web product extraction (LLM) + web-card builder + site config"
```

---

### Task 3: `browse_wiseup_website` tool; swap in for `search_wiseup_web`

Add the lazy `TavilyCrawl` getter and the tool, wire `TOOLS`, and remove `search_wiseup_web` and its test. Change the import from `TavilySearch` to `TavilyCrawl`.

**Files:**
- Modify: `tools.py` (import; add `_get_crawler`, `browse_wiseup_website`; delete `search_wiseup_web`; update `TOOLS`)
- Delete: `tests/test_web_tool.py`
- Test: `tests/test_web_crawl.py` (append tool tests)

**Interfaces:**
- Consumes: `tools._extract_web_products`, `tools.to_web_card`, `tools._rank_relevance`, `tools.SITE_URL`, `tools._format_tavily`.
- Produces:
  - `tools._get_crawler()` → object with `.invoke(dict)`
  - `tools.browse_wiseup_website` (`@tool`, `func(query, tool_call_id) -> Command`)
  - `tools.TOOLS == [retrieve_products, browse_wiseup_website, email_owner]`

- [ ] **Step 1: Write the failing tests (append to `tests/test_web_crawl.py`)**

```python
from langgraph.types import Command


def test_browse_returns_command_with_web_cards(monkeypatch):
    monkeypatch.setattr(tools, "_get_crawler",
                        lambda: type("C", (), {"invoke": lambda self, p: {"results": [{"url": "u"}]}})())
    monkeypatch.setattr(tools, "_extract_web_products", lambda res, q: [
        {"name": "Screwdriver", "price": None,
         "image_url": "https://x/s.png", "source_url": "https://x/p"}])

    cmd = tools.browse_wiseup_website.func(query="screwdriver", tool_call_id="t1")

    assert isinstance(cmd, Command)
    card = cmd.update["retrieved_products"][0]
    assert card["name_ar"] == "Screwdriver"
    assert card["image_url"] == "https://x/s.png"
    assert card["price_jod"] is None and card["code"] == ""
    assert cmd.update["messages"][0].tool_call_id == "t1"


def test_browse_no_products_does_not_wipe_cards(monkeypatch):
    monkeypatch.setattr(tools, "_get_crawler",
                        lambda: type("C", (), {"invoke": lambda self, p: {"results": []}})())
    monkeypatch.setattr(tools, "_extract_web_products", lambda res, q: [])

    cmd = tools.browse_wiseup_website.func(query="nothing", tool_call_id="t2")

    assert "retrieved_products" not in cmd.update            # existing cards preserved
    assert cmd.update["messages"][0].tool_call_id == "t2"
    assert "couldn't find" in cmd.update["messages"][0].content.lower()


def test_browse_crawler_exception_is_handled(monkeypatch):
    def boom():
        class C:
            def invoke(self, p): raise RuntimeError("crawl failed")
        return C()
    monkeypatch.setattr(tools, "_get_crawler", boom)

    cmd = tools.browse_wiseup_website.func(query="q", tool_call_id="t3")
    assert "retrieved_products" not in cmd.update
    assert cmd.update["messages"][0].tool_call_id == "t3"


def test_tools_list_swapped():
    names = [t.name for t in tools.TOOLS]
    assert "browse_wiseup_website" in names
    assert "search_wiseup_web" not in names
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_web_crawl.py -q`
Expected: FAIL (`AttributeError: module 'tools' has no attribute 'browse_wiseup_website'`).

- [ ] **Step 3: Update the import in `tools.py`**

Change line 14 from:
```python
from langchain_tavily import TavilySearch
```
to:
```python
from langchain_tavily import TavilyCrawl
```

- [ ] **Step 4: Delete `search_wiseup_web` and add the crawler + tool**

Delete the entire `search_wiseup_web` function (the `@tool` def and its body, ~lines 71-81). Add:
```python
_crawler = None


def _get_crawler():
    global _crawler
    if _crawler is None:
        _crawler = TavilyCrawl()
    return _crawler


@tool
def browse_wiseup_website(query: str,
                          tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Crawl the live WISEUP website (wiseuptools.com) for products or company info that is NOT
    in the local catalog, or when the customer explicitly asks about the website. Prefer
    retrieve_products first; only use this when the catalog has nothing relevant."""
    log(f"🔧 TOOL browse_wiseup_website(query={query!r}) [crawl {SITE_URL}]")
    try:
        res = _get_crawler().invoke({
            "url": SITE_URL, "instructions": query, "include_images": True,
            "extract_depth": "advanced", "format": "markdown", "max_depth": 2, "limit": 15,
        })
        recs = _extract_web_products(res, query)
    except Exception as e:
        log(f"🔧 TOOL browse_wiseup_website → error: {e}")
        recs = []
    if not recs:
        log("🔧 TOOL browse_wiseup_website → no products found")
        return Command(update={"messages": [ToolMessage(
            "I couldn't find that on the WISEUP website.", tool_call_id=tool_call_id)]})
    cards = [to_web_card(r, _rank_relevance(i, len(recs))) for i, r in enumerate(recs)]
    log(f"🔧 TOOL browse_wiseup_website → {len(cards)} product(s) from the website")
    return Command(update={
        "retrieved_products": cards,
        "messages": [ToolMessage(
            f"Found {len(cards)} product(s) on the WISEUP website.", tool_call_id=tool_call_id)],
    })
```

- [ ] **Step 5: Update `TOOLS` and delete the stale test file**

Change the `TOOLS` line to:
```python
TOOLS = [retrieve_products, browse_wiseup_website, email_owner]
```
Delete the obsolete search test file:
```bash
git rm tests/test_web_tool.py
```

- [ ] **Step 6: Run the crawl tests, then the full suite**

Run: `python -m pytest tests/test_web_crawl.py -q`
Expected: PASS.

Run: `python -m pytest -q`
Expected: PASS (whole suite green; no references to `search_wiseup_web` remain).

- [ ] **Step 7: Commit**

```bash
git add tools.py tests/test_web_crawl.py
git rm tests/test_web_tool.py
git commit -m "feat: browse_wiseup_website crawl tool replaces search_wiseup_web"
```

---

### Task 4: Re-scope the system prompt

Point the prompt at `browse_wiseup_website` and add the catalog-first rule.

**Files:**
- Modify: `agent_graph.py` (SYSTEM_PROMPT, the `search_wiseup_web` bullet ~line 23)
- Test: `tests/test_system_prompt.py` (add one test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `agent_graph.SYSTEM_PROMPT` naming `browse_wiseup_website` and the catalog-first rule.

- [ ] **Step 1: Write the failing test (append to `tests/test_system_prompt.py`)**

```python
def test_system_prompt_scopes_web_crawl():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "browse_wiseup_website" in p
    assert "search_wiseup_web" not in p
    assert "catalog" in p and "first" in p     # catalog-first rule present
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_system_prompt.py::test_system_prompt_scopes_web_crawl -q`
Expected: FAIL (prompt still says `search_wiseup_web`).

- [ ] **Step 3: Update the prompt in `agent_graph.py`**

Replace the `search_wiseup_web` tool bullet (around line 23) with:
```python
- browse_wiseup_website: crawl the live WISEUP website (wiseuptools.com) for products or company \
info that is NOT in the local catalog. Always try retrieve_products FIRST; only crawl the website \
when the catalog returns nothing relevant, or the customer explicitly asks about the website. \
Website product prices may be missing — the catalog is the source of truth for prices.
```

- [ ] **Step 4: Run the prompt tests to verify they pass**

Run: `python -m pytest tests/test_system_prompt.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add agent_graph.py tests/test_system_prompt.py
git commit -m "feat: prompt scopes browse_wiseup_website (catalog-first)"
```

---

### Task 5: Frontend web-card guards

Make the card renderer tolerate web-cards: hide the price when absent; show a "View on site" link instead of an empty code.

**Files:**
- Modify: `frontend/index.html` (`card()`, the price `<span>` and the `كود:` line, ~lines 166-169)

**Interfaces:**
- Consumes: card objects that may have `price_jod: null` and a `source_url`.
- Produces: no JS API change; purely rendering.

- [ ] **Step 1: Update the price line**

In `frontend/index.html`, replace:
```html
        <span class="text-base font-bold text-brand">${p.price_jod} JOD</span>
```
with:
```html
        <span class="text-base font-bold text-brand">${p.price_jod != null ? p.price_jod + ' JOD' : ''}</span>
```

- [ ] **Step 2: Update the code / source line**

Replace:
```html
      <span class="text-xs text-text-muted font-mono" dir="ltr">كود: ${p.code}</span>
```
with:
```html
      ${p.code
        ? `<span class="text-xs text-text-muted font-mono" dir="ltr">كود: ${p.code}</span>`
        : (p.source_url
            ? `<a href="${p.source_url}" target="_blank" rel="noopener" class="text-xs text-brand underline" dir="rtl">عرض على الموقع</a>`
            : '')}
```

- [ ] **Step 3: Verify catalog cards are unaffected (manual)**

Open `frontend/index.html` and confirm the two edited expressions are syntactically valid template literals (matched backticks/braces). Catalog cards have `code` and `price_jod`, so they render `كود: <code>` and `<price> JOD` exactly as before. (No JS test harness in this repo; behavior is verified in the Task 6 live smoke.)

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "feat: card() handles web-cards (optional price, source link)"
```

---

### Task 6: Live smoke (manual, no new code)

**Files:** none.

- [ ] **Step 1: Restart the server**

```bash
python -m uvicorn api:app --host 127.0.0.1 --port 8000 --log-level warning
```

- [ ] **Step 2: Catalog-first check**

In the browser at http://127.0.0.1:8000, ask a normal Arabic product query (e.g. «مفك»). Expected: catalog cards; the log shows `retrieve_products`, NOT `browse_wiseup_website`.

- [ ] **Step 3: Website crawl check**

Ask for something the catalog lacks or say «شوف الموقع» / "check the website for X". Expected: the log shows `browse_wiseup_website`; the UI shows web product cards with images and a "عرض على الموقع" link (price may be absent — no "undefined JOD").

- [ ] **Step 4: No-results check**

Ask the website for something nonsensical. Expected: a friendly "couldn't find that on the WISEUP website" reply, no crash, and any previously shown cards remain.

- [ ] **Step 5: Record the result**

Note in the PR/commit description whether Tavily's per-product image mapping looked good enough, or whether Firecrawl should be revisited.

---

## Notes for the implementer

- The dense/LLM paths require keys in the gitignored `.env` (loaded by `api.py`); tests never hit them — always monkeypatch `_get_crawler` / `_web_llm` / `_extract_web_products` as shown.
- Do not add caching or crawl the whole site; `max_depth: 2`, `limit: 15` are deliberate (see spec §10).
