"""RAG over the WISEUP catalog: retrieve products from Chroma.

Embeddings are pluggable via WISEUP_EMBED_BACKEND:
  - "openai": text-embedding-3-small (multilingual, e.g. Arabic + English)
  - "hf":     local all-MiniLM-L6-v2 (free, English-centric) -- the fallback
Each backend has its own Chroma folder/collection (vector spaces differ), so
switching does NOT require deleting the other index.
"""
import os
from langchain_chroma import Chroma

PRODUCTS_PATH = "products.json"

EMBED_BACKEND = os.environ.get("WISEUP_EMBED_BACKEND", "openai").lower()  # "openai" | "hf"
HF_EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
OPENAI_EMBED_MODEL = os.environ.get("WISEUP_EMBED_MODEL", "text-embedding-3-small")


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
