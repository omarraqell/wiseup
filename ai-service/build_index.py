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
        for item in os.listdir(persist):
            item_path = os.path.join(persist, item)
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.unlink(item_path)
            except Exception as e:
                print(f"Error deleting {item_path}: {e}")
    Chroma.from_documents(documents=docs, embedding=embeddings,
                          persist_directory=persist, collection_name=collection)
    print(f"indexed {len(docs)} products into {persist}/{collection}")


if __name__ == "__main__":
    main()
