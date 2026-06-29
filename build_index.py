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
