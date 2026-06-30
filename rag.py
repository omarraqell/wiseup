"""RAG over the WISEUP catalog: retrieve products from Chroma.

Embeddings are pluggable via WISEUP_EMBED_BACKEND:
  - "openai": text-embedding-3-small (multilingual, e.g. Arabic + English)
  - "hf":     local all-MiniLM-L6-v2 (free, English-centric) -- the fallback
Each backend has its own Chroma folder/collection (vector spaces differ), so
switching does NOT require deleting the other index.
"""
import json
import os
import re
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever

PRODUCTS_PATH = "products.json"

EMBED_BACKEND = os.environ.get("WISEUP_EMBED_BACKEND", "openai").lower()  # "openai" | "hf"
HF_EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
OPENAI_EMBED_MODEL = os.environ.get("WISEUP_EMBED_MODEL", "text-embedding-3-small")


def _bm25_preprocess(text: str) -> list[str]:
    """Lowercase + keep runs of digits/Latin/Arabic letters so codes like 10104
    tokenize cleanly. No diacritic/alef folding (negligible for this catalog)."""
    return re.findall(r"[0-9a-z؀-ۿ]+", (text or "").lower())


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


_store = None


def get_embeddings():
    """Embedding function for the active backend."""
    if EMBED_BACKEND == "openai":
        from langchain_openai import OpenAIEmbeddings
        if not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
        return OpenAIEmbeddings(model=OPENAI_EMBED_MODEL)
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(model_name=HF_EMBED_MODEL)


def store_config():
    """(persist_dir, collection_name) for the active backend."""
    if EMBED_BACKEND == "openai":
        return "./chroma_db_openai", "wiseup_products_openai"
    return "./chroma_db", "wiseup_products"


def get_store():
    global _store
    if _store is None:
        persist, collection = store_config()
        _store = Chroma(persist_directory=persist, collection_name=collection,
                        embedding_function=get_embeddings())
    return _store


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


def retrieve(query, k=8):
    return get_store().similarity_search_with_score(query, k=k)


def build_context(results):
    lines = []
    for doc, _ in results:
        m = doc.metadata
        lines.append(
            f"- {m.get('name_ar','')} | السعر: {m.get('price_jod','')} JOD | "
            f"الوحدة: {m.get('unit','')} | كود: {m.get('code','')}")
    return "\n".join(lines)


# Chroma L2 distance: <= this means a genuine product match; above = small talk / off-topic.
# Tuned per embedding backend (different models -> different distance scales).
RELEVANCE_THRESHOLD = float(os.environ.get(
    "WISEUP_REL_THRESHOLD", "1.35" if EMBED_BACKEND == "openai" else "1.2"))


def gate(results):
    """Keep only genuine product matches (distance below threshold)."""
    return [(d, s) for d, s in results if s <= RELEVANCE_THRESHOLD]
