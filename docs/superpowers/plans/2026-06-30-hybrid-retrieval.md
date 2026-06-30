# Hybrid Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hybrid retrieval (BM25 keyword + dense semantic, fused with RRF) so exact product codes and exact Arabic terms rank well, while keeping the greeting gate.

**Architecture:** Approach A from the spec. `rag.py` builds an in-memory `BM25Retriever` over the same product documents as the Chroma index and fuses it with the dense retriever via `EnsembleRetriever`. A small dense `similarity_search_with_score(k=1)` is kept purely as the off-topic gate. Cards get a rank-based relevance badge. The agent graph, lead flow, and `build_index.py`'s Chroma build are unchanged except for importing the now-shared `describe`/`clean_meta`.

**Tech Stack:** Python, LangChain (`langchain_community.retrievers.BM25Retriever`, `langchain_classic.retrievers.EnsembleRetriever`), `rank_bm25`, Chroma, OpenAI embeddings, pytest.

## Global Constraints

- Tests MUST be network-free: never call OpenAI/Chroma-with-embeddings in a test. Monkeypatch the dense side.
- Correct import paths (verified in this environment, langchain 1.3.11): `from langchain_community.retrievers import BM25Retriever` and `from langchain_classic.retrievers import EnsembleRetriever`. The hybrid-retrieval skill's `langchain.retrievers` path is OUTDATED — do not use it.
- `EnsembleRetriever` fuses by matching `page_content`; BM25 docs and Chroma docs for a product MUST have identical `page_content = describe(p)` and `metadata = clean_meta(p)`.
- Default weights env knob `WISEUP_HYBRID_WEIGHTS="kw,vec"` default `"0.5,0.5"`, mapping to `retrievers=[bm25, dense]`.
- Keep the existing gate env knob `WISEUP_REL_THRESHOLD` (default `1.35` for openai backend).
- Retrieval breadth `k=8` (env `WISEUP_RETRIEVE_K`).
- Run all tests with `python -m pytest -q` (Windows; PowerShell or Bash tool).

---

### Task 1: Share `describe` / `clean_meta` from `rag.py`

Move the two document builders into `rag.py` so BM25 (rag) and Chroma (build_index) produce identical documents. `build_index.py` imports them instead of defining its own.

**Files:**
- Modify: `rag.py` (add `describe`, `clean_meta`, `PRODUCTS_PATH`)
- Modify: `build_index.py:9-23` (delete local `describe`/`clean_meta`, import from `rag`)
- Test: `tests/test_rag_hybrid.py` (new)

**Interfaces:**
- Produces: `rag.describe(p: dict) -> str`, `rag.clean_meta(p: dict) -> dict`, `rag.PRODUCTS_PATH: str`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_rag_hybrid.py`:
```python
import rag
import build_index


def test_describe_and_clean_meta():
    p = {"code": "10104", "name_ar": "زرادية كهرباء", "unit": "pcs",
         "price_jod": 1.85, "image": "images/10104.png"}
    assert rag.describe(p) == "زرادية كهرباء (كود 10104)"
    meta = rag.clean_meta(p)
    assert meta == {"code": "10104", "name_ar": "زرادية كهرباء", "unit": "pcs",
                    "price_jod": 1.85, "image": "images/10104.png"}


def test_build_index_uses_shared_builders():
    # build_index must reuse rag's builders so BM25 and Chroma docs stay identical.
    assert build_index.describe is rag.describe
    assert build_index.clean_meta is rag.clean_meta
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_rag_hybrid.py -q`
Expected: FAIL (`AttributeError: module 'rag' has no attribute 'describe'`).

- [ ] **Step 3: Add the builders to `rag.py`**

In `rag.py`, after the imports add:
```python
PRODUCTS_PATH = "products.json"


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
```

- [ ] **Step 4: Make `build_index.py` import them**

Replace `build_index.py` lines 12-23 (the local `describe` and `clean_meta` defs) so the file imports from `rag`:
```python
import rag
from rag import describe, clean_meta
```
(Keep the rest of `build_index.py` unchanged; `main()` already calls `describe`/`clean_meta`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_rag_hybrid.py -q`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add rag.py build_index.py tests/test_rag_hybrid.py
git commit -m "refactor: share describe/clean_meta from rag so BM25 and Chroma docs match"
```

---

### Task 2: BM25 tokenizer

Pure function, no I/O. A lowercasing, punctuation-splitting tokenizer so BM25 matches exact codes (the indexed text is `name (كود 10104)`; the default whitespace tokenizer would leave `10104)` with the paren attached and fail an exact-code query). Deliberately no diacritic/alef normalization — negligible for this unvoweled catalog, and it avoids fragile combining-mark regexes.

**Files:**
- Modify: `rag.py` (add `_bm25_preprocess`)
- Test: `tests/test_rag_hybrid.py`

**Interfaces:**
- Produces: `rag._bm25_preprocess(text: str) -> list[str]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_rag_hybrid.py`:
```python
def test_bm25_preprocess_tokenizes_code_and_lowercases():
    toks = rag._bm25_preprocess("زرادية كهرباء (كود 10104)")
    assert "10104" in toks                                 # code is a clean token
    assert "كود" in toks
    assert "(كود" not in toks and "10104)" not in toks     # punctuation stripped
    assert rag._bm25_preprocess("ABC") == ["abc"]          # lowercased
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_rag_hybrid.py -k preprocess -q`
Expected: FAIL (`AttributeError: ... '_bm25_preprocess'`).

- [ ] **Step 3: Implement in `rag.py`**

Add near the top of `rag.py` (after `import os`, add `import re`):
```python
def _bm25_preprocess(text: str) -> list[str]:
    """Lowercase + keep runs of digits/Latin/Arabic letters so codes like 10104
    tokenize cleanly. No diacritic/alef folding (negligible for this catalog)."""
    return re.findall(r"[0-9a-z؀-ۿ]+", (text or "").lower())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_rag_hybrid.py -k preprocess -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rag.py tests/test_rag_hybrid.py
git commit -m "feat: simple code-aware BM25 tokenizer"
```

---

### Task 3: BM25 + ensemble retrievers, gate, and `hybrid_retrieve`

Add the hybrid core to `rag.py` as lazy singletons (so importing `rag` never builds Chroma/OpenAI eagerly). Does NOT yet change `build_context` or touch `tools.py` — the old `retrieve`/`gate`/`build_context` stay so the suite remains green.

**Files:**
- Modify: `rag.py` (add BM25/ensemble/gate/hybrid; add `K`)
- Modify: `requirements.txt`
- Test: `tests/test_rag_hybrid.py`

**Interfaces:**
- Consumes: `rag.describe`, `rag.clean_meta`, `rag._bm25_preprocess`, `rag.get_store`, `rag.RELEVANCE_THRESHOLD` (existing).
- Produces:
  - `rag.K: int`
  - `rag._get_bm25() -> BM25Retriever`
  - `rag._get_dense() -> BaseRetriever`
  - `rag._get_ensemble() -> EnsembleRetriever`
  - `rag.gate_ok(query: str) -> bool`
  - `rag.hybrid_retrieve(query: str, k: int = rag.K) -> list[Document]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_rag_hybrid.py`:
```python
import json
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from typing import List


def _first_code():
    rows = json.load(open("products.json", encoding="utf-8"))
    return str(rows[0]["code"])


def test_bm25_ranks_exact_code_first():
    code = _first_code()
    docs = rag._get_bm25().invoke(code)
    assert docs and str(docs[0].metadata["code"]) == code


def test_hybrid_retrieve_returns_empty_when_gate_fails(monkeypatch):
    monkeypatch.setattr(rag, "gate_ok", lambda q: False)
    assert rag.hybrid_retrieve("مرحبا") == []


def test_hybrid_retrieve_fuses_bm25_and_dense(monkeypatch):
    code = _first_code()

    class FakeDense(BaseRetriever):
        def _get_relevant_documents(self, query, *, run_manager=None) -> List[Document]:
            # pretend semantic order: unrelated doc first
            return [Document(page_content="other (كود 00000)",
                             metadata={"code": "00000", "name_ar": "x",
                                       "unit": "", "price_jod": 0, "image": ""})]

    monkeypatch.setattr(rag, "gate_ok", lambda q: True)
    monkeypatch.setattr(rag, "_get_dense", lambda: FakeDense())
    # Bias toward BM25 so the exact-code match (BM25-only) deterministically beats the
    # FakeDense doc (dense-only) instead of tying on RRF; reset the cached ensemble so
    # the new weights take effect.
    monkeypatch.setenv("WISEUP_HYBRID_WEIGHTS", "0.9,0.1")
    monkeypatch.setattr(rag, "_ensemble", None, raising=False)

    docs = rag.hybrid_retrieve(code, k=8)
    codes = [str(d.metadata["code"]) for d in docs]
    assert code in codes
    assert codes[0] == code                      # exact code fused to the top
    assert len(codes) == len(set(codes))         # no duplicate products
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_rag_hybrid.py -k "bm25_ranks or hybrid_retrieve" -q`
Expected: FAIL (`AttributeError: ... '_get_bm25'`).

- [ ] **Step 3: Implement the hybrid core in `rag.py`**

Add imports at the top of `rag.py`:
```python
import json
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
```
Add after `get_store()` (keep the existing `RELEVANCE_THRESHOLD` definition where it is):
```python
K = int(os.environ.get("WISEUP_RETRIEVE_K", "8"))

_products = None
_bm25 = None
_ensemble = None


def _load_products():
    global _products
    if _products is None:
        _products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    return _products


def _get_bm25():
    global _bm25
    if _bm25 is None:
        docs = [Document(page_content=describe(p), metadata=clean_meta(p))
                for p in _load_products()]
        _bm25 = BM25Retriever.from_documents(docs, preprocess_func=_bm25_preprocess)
        _bm25.k = K
    return _bm25


def _get_dense():
    return get_store().as_retriever(search_kwargs={"k": K})


def _weights():
    raw = os.environ.get("WISEUP_HYBRID_WEIGHTS", "0.5,0.5")
    kw, vec = (float(x) for x in raw.split(","))
    return [kw, vec]


def _get_ensemble():
    global _ensemble
    if _ensemble is None:
        _ensemble = EnsembleRetriever(
            retrievers=[_get_bm25(), _get_dense()], weights=_weights())
    return _ensemble


def _dense_scored(query, k=1):
    return get_store().similarity_search_with_score(query, k=k)


def gate_ok(query) -> bool:
    """Greeting/off-topic gate: pass only if the best dense match is close enough."""
    scored = _dense_scored(query, k=1)
    return bool(scored) and scored[0][1] <= RELEVANCE_THRESHOLD


def hybrid_retrieve(query, k=K):
    """Hybrid BM25+dense retrieval. Returns [] for off-topic queries (gate)."""
    if not gate_ok(query):
        return []
    return _get_ensemble().invoke(query)[:k]
```

- [ ] **Step 4: Add dependencies to `requirements.txt`**

Append to `requirements.txt`:
```
langchain-community
langchain-classic
rank-bm25
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_rag_hybrid.py -q`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Run the full suite (must stay green — tools still uses old retrieve/gate)**

Run: `python -m pytest -q`
Expected: PASS (no regressions; old `rag.retrieve`/`rag.gate`/`rag.build_context` untouched).

- [ ] **Step 7: Commit**

```bash
git add rag.py requirements.txt tests/test_rag_hybrid.py
git commit -m "feat: BM25+ensemble hybrid_retrieve with dense gate in rag"
```

---

### Task 4: Wire `tools.py` to hybrid + rank-based cards; retire old retrieve API

Switch `retrieve_products` to `hybrid_retrieve`, change `to_card` to take a rank-based relevance, change `build_context` to take Documents, and delete the now-unused `rag.retrieve`/`rag.gate`. Update the affected tests in the same commit so the suite stays green.

**Files:**
- Modify: `rag.py` (change `build_context(docs)`; delete `retrieve` and `gate`)
- Modify: `tools.py:19-29` (`to_card`), `tools.py:36-49` (`retrieve_products`); add `_rank_relevance`
- Modify: `tests/test_tool_helpers.py:5-15`
- Modify: `tests/test_retrieve_tool.py`
- Modify: `tests/test_agent_graph.py:20-26` (parallel test monkeypatch)

**Interfaces:**
- Consumes: `rag.hybrid_retrieve`, `rag.build_context(docs)`.
- Produces: `tools.to_card(doc, relevance: int) -> dict`, `tools._rank_relevance(i: int, n: int) -> int`.

- [ ] **Step 1: Update the failing tests first**

In `tests/test_tool_helpers.py` replace the `to_card` test body to pass a rank int:
```python
def test_to_card_maps_new_schema_and_image():
    doc = Document(page_content="x", metadata={
        "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
        "price_jod": 2.5, "image": "images/10101.png"})
    card = tools.to_card(doc, 95)
    assert card["code"] == "10101"
    assert card["name_ar"].startswith("زرادية")
    assert card["price_jod"] == 2.5
    assert card["unit"] == "pcs"
    assert card["image_url"] == "/images/10101.png"
    assert card["relevance"] == 95


def test_rank_relevance_is_monotonic_descending():
    assert tools._rank_relevance(0, 8) > tools._rank_relevance(7, 8)
    assert tools._rank_relevance(0, 1) == 95
```
(Keep `test_lookup_products_returns_known_item` unchanged.)

Replace `tests/test_retrieve_tool.py` to monkeypatch `hybrid_retrieve`:
```python
from langchain_core.documents import Document
from langgraph.types import Command
import tools


def test_retrieve_products_returns_command_with_cards(monkeypatch):
    doc = Document(page_content="زرادية", metadata={
        "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
        "price_jod": 2.5, "image": "images/10101.png"})
    monkeypatch.setattr(tools.rag, "hybrid_retrieve", lambda q, k=8: [doc])

    cmd = tools.retrieve_products.func(query="زرادية", tool_call_id="tc1")

    assert isinstance(cmd, Command)
    assert cmd.update["retrieved_products"][0]["code"] == "10101"
    assert cmd.update["retrieved_products"][0]["price_jod"] == 2.5
    assert 5 <= cmd.update["retrieved_products"][0]["relevance"] <= 100
    msg = cmd.update["messages"][0]
    assert msg.tool_call_id == "tc1"
    assert "زرادية" in msg.content
```

In `tests/test_agent_graph.py` update the parallel test's monkeypatches (lines ~24-26) from `retrieve`/`gate`/`build_context` to:
```python
    monkeypatch.setattr(rag, "hybrid_retrieve", lambda q, k=8: [])
    monkeypatch.setattr(rag, "build_context", lambda docs: "ctx")
```
(Remove the `rag.retrieve` and `rag.gate` monkeypatch lines.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_tool_helpers.py tests/test_retrieve_tool.py -q`
Expected: FAIL (`to_card` still computes from score; `tools.rag.hybrid_retrieve` patched but `retrieve_products` still calls `rag.gate(rag.retrieve(...))`).

- [ ] **Step 3: Update `rag.build_context` and delete old API**

In `rag.py`, replace `build_context` and delete `retrieve` and `gate`:
```python
def build_context(docs):
    lines = []
    for doc in docs:
        m = doc.metadata
        lines.append(
            f"- {m.get('name_ar','')} | السعر: {m.get('price_jod','')} JOD | "
            f"الوحدة: {m.get('unit','')} | كود: {m.get('code','')}")
    return "\n".join(lines)
```
Delete the old `def retrieve(query, k=8): ...` and `def gate(results): ...` functions.

- [ ] **Step 4: Update `tools.py`**

Replace `to_card` (lines 19-29) and add `_rank_relevance`:
```python
def to_card(doc, relevance):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "code": m.get("code", ""),
        "name_ar": m.get("name_ar", ""),
        "price_jod": m.get("price_jod", 0),
        "unit": m.get("unit", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        "relevance": int(relevance),
    }


def _rank_relevance(i, n):
    """Map rank position 0..n-1 to a 95..55 badge (UI nicety; order is what matters)."""
    if n <= 1:
        return 95
    return round(95 - (i / (n - 1)) * 40)
```
Replace the body of `retrieve_products` (lines 41-49) with:
```python
    log(f"🔧 TOOL retrieve_products(query={query!r})")
    docs = rag.hybrid_retrieve(query, k=8)
    cards = [to_card(d, _rank_relevance(i, len(docs))) for i, d in enumerate(docs)]
    log(f"🔧 TOOL retrieve_products → found {len(cards)} product(s)")
    summary = rag.build_context(docs) or "No matching products found."
    return Command(update={
        "retrieved_products": cards,
        "messages": [ToolMessage(summary, tool_call_id=tool_call_id)],
    })
```

- [ ] **Step 5: Run the updated tests, then the full suite**

Run: `python -m pytest tests/test_tool_helpers.py tests/test_retrieve_tool.py tests/test_agent_graph.py -q`
Expected: PASS.

Run: `python -m pytest -q`
Expected: PASS (whole suite green).

- [ ] **Step 6: Commit**

```bash
git add rag.py tools.py tests/test_tool_helpers.py tests/test_retrieve_tool.py tests/test_agent_graph.py
git commit -m "feat: wire retrieve_products to hybrid retrieval with rank-based cards"
```

---

### Task 5: Live smoke (manual, no new code)

Verify the end-to-end behavior against the running app.

**Files:** none (manual verification).

- [ ] **Step 1: Restart the server**

```bash
python -m uvicorn api:app --host 127.0.0.1 --port 8000 --log-level warning
```

- [ ] **Step 2: Exact-code query**

In the browser at http://127.0.0.1:8000, ask with a real code from `products.json` (e.g. the first code). Expected: that product appears as the top card.

- [ ] **Step 3: Exact Arabic term**

Ask an Arabic product term (e.g. «مفك صليبة»). Expected: literal matches rank among the top cards.

- [ ] **Step 4: Greeting gate**

Send «مرحبا». Expected: a friendly reply with **no** product cards (gate still works).

- [ ] **Step 5: Record the result**

Note in the PR/commit description whether weights need tuning (toward keyword per the catalog guidance) based on what you saw.

---

## Notes for the implementer

- The dense side requires `OPENAI_API_KEY` (in the gitignored `.env`, loaded by `api.py`); tests must never hit it — always monkeypatch `gate_ok`/`_get_dense` as shown.
- BM25 is built once from `products.json` (633 rows) on first use — no persistence, instant.
- Do not "fix" the card↔lead mismatch or add quantities here; those are separate, out of scope (see spec §8).
