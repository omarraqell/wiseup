"""Build the Chroma vector index from the catalog.

The embedding backend is chosen by WISEUP_EMBED_BACKEND (see rag.py):
  WISEUP_EMBED_BACKEND=openai python build_index.py   # multilingual OpenAI
  WISEUP_EMBED_BACKEND=hf     python build_index.py   # local MiniLM (free)

If products_bilingual.json exists, the index is built BILINGUAL: every product
gets two parallel documents (English + Arabic) that share the same metadata, so
an Arabic query matches the Arabic doc and an English query matches the English
doc -- both return the same product card.
"""
import json
import os
from langchain_core.documents import Document
from langchain_chroma import Chroma
import rag

PRODUCTS = "products.json"
PRODUCTS_BILINGUAL = "products_bilingual.json"


def describe(p):
    """Natural-language text that gets embedded + shown as the card description."""
    parts = []
    name = p.get("product_name") or "Product"
    parts.append(f"{name} — {p.get('series','')}".strip(" —"))
    if p.get("material"): parts.append(f"Material: {p['material']}.")
    if p.get("size"):     parts.append(f"Size: {p['size']}.")
    if p.get("packing"):  parts.append(f"Packing: {p['packing']}.")
    if p.get("gross_weight"): parts.append(f"Gross weight: {p['gross_weight']}.")
    if p.get("cbm"):      parts.append(f"CBM: {p['cbm']}.")
    parts.append(f"Item No: {p['item_no']}.")
    return " ".join(parts)


def clean_meta(p):
    m = {}
    for k, v in p.items():
        m[k] = "" if v is None else (v if isinstance(v, (str, int, float, bool)) else str(v))
    m["description"] = describe(p)
    return m


def main():
    bilingual = os.path.exists(PRODUCTS_BILINGUAL)
    src = PRODUCTS_BILINGUAL if bilingual else PRODUCTS
    products = json.load(open(src, encoding="utf-8"))

    docs = []
    for p in products:
        meta = clean_meta(p)                       # carries both EN + AR fields
        # English document
        docs.append(Document(page_content=describe(p), metadata={**meta, "lang": "en"}))
        # Parallel Arabic document (same metadata -> same card)
        if bilingual and p.get("description_ar"):
            docs.append(Document(page_content=p["description_ar"], metadata={**meta, "lang": "ar"}))

    persist, collection = rag.store_config()
    mode = "BILINGUAL (en+ar)" if bilingual else "English only"
    print(f"Building {mode} index: {len(docs)} docs / {len(products)} products | "
          f"backend={rag.EMBED_BACKEND} -> {persist} ...")
    embeddings = rag.get_embeddings()
    # rebuild from scratch
    import shutil
    if os.path.isdir(persist):
        shutil.rmtree(persist)
    Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=persist,
        collection_name=collection,
    )
    print(f"Done. Vector store at {persist} (collection: {collection}).")


if __name__ == "__main__":
    main()
