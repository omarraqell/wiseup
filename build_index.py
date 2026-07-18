"""Build the Chroma index from products.json (Arabic, priced schema)."""
import json
import os
import shutil
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.documents import Document
import rag
from rag import describe, clean_meta


def main():
    load_dotenv()  # standalone runs need OPENAI_API_KEY from .env (api.py loads it itself)
    products = json.load(open(rag.PRODUCTS_PATH, encoding="utf-8"))
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
