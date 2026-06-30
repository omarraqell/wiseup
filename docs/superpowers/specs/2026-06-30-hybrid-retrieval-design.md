# Hybrid Retrieval (BM25 + Semantic) — Design Spec

**Date:** 2026-06-30
**Project:** WISEUP Catalog Assistant (agentic RAG on LangGraph)
**Branch:** `feature/hybrid-retrieval`
**Status:** Approved design → ready for implementation plan

## 1. Goal

Improve retrieval recall by combining **keyword (BM25)** and **semantic (dense)** search, so
exact product **codes** (`10104`, `90108`) and exact **Arabic terms** the customer typed rank
well — cases pure embeddings sometimes bury. Use LangChain's `BM25Retriever` +
`EnsembleRetriever` (Reciprocal Rank Fusion), per the installed `hybrid-retrieval` skill
(Approach **A** — ensemble for ranking, a small dense check kept as the gate).

The agentic graph, tools, cards, and lead flow are unchanged. Only **`rag.py` retrieval** and
the way `tools.retrieve_products` consumes it change.

## 2. The core constraint

Today `rag.retrieve()` returns `(Document, L2_distance)` pairs, and that distance drives two
things: (1) the **gate** — return *no products* for greetings/off-topic queries; and (2) the
**relevance %** on each card. `EnsembleRetriever` fuses via RRF and returns **plain ranked
Documents with no scores**. So the design keeps the gate as a separate dense check and makes the
relevance badge **rank-based**.

## 3. Corpus parity (critical)

`EnsembleRetriever` fuses results from the two retrievers by matching on **`page_content`**. The
BM25 documents and the Chroma documents for the same product **must have identical
`page_content`**, or fusion duplicates instead of combining ranks.

To guarantee this, move the two builders into `rag.py` as the single source of truth and have
`build_index.py` import them:

- `describe(p) -> str` = `f"{p['name_ar']} (كود {p['code']})"` (the embedded/indexed text).
- `clean_meta(p) -> dict` = `{code, name_ar, unit, price_jod, image}`.

Both Chroma (via `build_index.py`) and BM25 (via `rag.py`) then produce documents with the same
`page_content = describe(p)` and `metadata = clean_meta(p)`, so `to_card` works on a Document
from either retriever.

## 4. `rag.py` changes

### 4.1 BM25 tokenizer
BM25Retriever's default tokenizer only splits on whitespace, so the indexed text `name (كود
10104)` yields the token `10104)` (paren attached) and an exact-code query fails. Add a small
tokenizer:

- `_bm25_preprocess(text) -> list[str]` — lowercase, then keep runs of digits/Latin/Arabic
  letters: `re.findall(r"[0-9a-z؀-ۿ]+", text.lower())`. Codes like `10104` tokenize
  cleanly.

No diacritic/tatweel/alef folding — negligible for this (unvoweled) catalog, and it avoids fragile
combining-mark regexes. Revisit only if Arabic keyword recall looks short.

### 4.2 Retrievers (built once at import, in-memory)
- `_products()` — load `products.json`.
- BM25: `BM25Retriever.from_documents([Document(describe(p), clean_meta(p)) ...],
  preprocess_func=_bm25_preprocess)`, `bm25.k = K`.
- Dense: `get_store().as_retriever(search_kwargs={"k": K})` (existing Chroma store).
- Ensemble: `EnsembleRetriever(retrievers=[bm25, dense], weights=_weights())`.
  - `K` default 8. `_weights()` reads `WISEUP_HYBRID_WEIGHTS` (`"kw,vec"`, default `"0.5,0.5"`);
    the catalog guidance is keyword-leaning, so we tune toward `0.6,0.4`+ during calibration.

### 4.3 Gate + retrieve contract
- `gate_ok(query) -> bool` — run `get_store().similarity_search_with_score(query, k=1)`; pass if
  best distance `<= RELEVANCE_THRESHOLD` (keep the `WISEUP_REL_THRESHOLD` env knob). This
  preserves today's greeting/off-topic suppression unchanged.
- `hybrid_retrieve(query, k=K) -> list[Document]` — if `not gate_ok(query)` → `[]`; else
  `ensemble.invoke(query)[:k]`.
- `build_context(docs: list[Document]) -> str` — unchanged Arabic+JOD lines, but takes Documents
  (no scores). The old `(doc, score)` `retrieve`/`gate` pair is replaced; keep a private
  `_dense_scored` only for `gate_ok`.

## 5. `tools.py` changes

- `to_card(doc, relevance: int)` — take a precomputed rank-based relevance (0–100) instead of a
  distance score; metadata read is unchanged.
- `retrieve_products(query, tool_call_id)`:
  ```python
  docs = rag.hybrid_retrieve(query, k=8)
  cards = [to_card(d, _rank_relevance(i, len(docs))) for i, d in enumerate(docs)]
  summary = rag.build_context(docs) or "No matching products found."
  ```
  `_rank_relevance(i, n)` scales position 0..n-1 to ~95..55 (a UI nicety; ordering is what
  matters). The `Command(update={"retrieved_products": cards, ...})` shape is unchanged (and the
  parallel-write reducer from `7dab28a` still applies).

## 6. Dependencies

Add to `requirements.txt`: `rank-bm25` (BM25Retriever backend), `langchain-community` (`BM25Retriever`), and `langchain-classic` (`EnsembleRetriever`). NOTE (verified in this env, langchain 1.3.11): `EnsembleRetriever` lives in `langchain_classic.retrievers`, NOT `langchain.retrievers` — the skill's path is outdated.

## 7. Tests (all network-free)

- `tests/test_rag_hybrid.py` (new):
  - `_bm25_preprocess` — punctuation stripped, lowercased, a code stays one token.
  - BM25-only: build from a small product set; an exact-code query ranks that product first.
  - Ensemble: real BM25 + a **fake dense retriever** (returns fixed Documents, no network); an
    exact-code query surfaces the code doc at/near top; identical `page_content` ⇒ no duplicates.
  - `gate_ok` returns `False` when `_dense_scored` is monkeypatched to a far distance, `True` when
    near; `hybrid_retrieve` returns `[]` when the gate fails.
- `tests/test_tool_helpers.py` — `to_card` uses the passed rank relevance; `_rank_relevance`
  monotonic.
- `tests/test_retrieve_tool.py` — `retrieve_products` calls `rag.hybrid_retrieve` (monkeypatched),
  builds cards with the new schema, returns the `Command`.
- `build_index.py` smoke — imports `describe`/`clean_meta` from `rag` and builds without error.

## 8. Out of scope (YAGNI)

- Cross-encoder / Cohere **reranking** and **query expansion** (skill mentions them; revisit only
  if recall is still short after weight tuning).
- Qdrant/native sparse vectors; persisting the BM25 index (in-memory build over 633 rows is
  instant).
- The **card↔lead mismatch** and **quantities** gaps seen in live testing — tracked separately
  (threads #2/#3), not part of this spec.

## 9. Acceptance criteria

1. An exact **code** query (a real code from `products.json`) returns that product at or near the
   top of the cards.
2. An exact **Arabic term** query ranks the literal match competitively with semantic neighbours.
3. A greeting/off-topic query (e.g. «مرحبا») still returns **no products** (gate preserved).
4. Cards still render image, Arabic name, code, and JOD price, with a rank-based relevance badge;
   no duplicate cards for a product.
5. `python build_index.py` still builds Chroma using the shared `describe`/`clean_meta`.
6. `python -m pytest -q` is green, with no network calls in tests.
