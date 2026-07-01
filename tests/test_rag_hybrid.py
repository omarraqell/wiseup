import json
import rag
import build_index
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from typing import List


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


def test_bm25_preprocess_tokenizes_code_and_lowercases():
    toks = rag._bm25_preprocess("زرادية كهرباء (كود 10104)")
    assert "10104" in toks                                 # code is a clean token
    assert "كود" in toks
    assert "(كود" not in toks and "10104)" not in toks     # punctuation stripped
    assert rag._bm25_preprocess("ABC") == ["abc"]          # lowercased


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
    first = json.load(open("products.json", encoding="utf-8"))[0]
    code = str(first["code"])
    same = Document(page_content=rag.describe(first), metadata=rag.clean_meta(first))

    class FakeDense(BaseRetriever):
        def _get_relevant_documents(self, query, *, run_manager=None) -> List[Document]:
            return [same]

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
    assert codes.count(code) == 1                # same product from both retrievers appears exactly once
    assert len(codes) == len(set(codes))         # no duplicate products
