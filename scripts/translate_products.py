"""One-shot: translate the 633 Arabic product names to English.

Batched at 25/call and cached to data/names_en.json after every batch, so an
interrupted run resumes instead of re-paying for completed batches.
"""
import json
import os
from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from scripts._llm import call_json, save_json

PRODUCTS_PATH = "products.json"
OUT_PATH = "data/names_en.json"
BATCH = 25

PROMPT = """You translate hand-tool product names from Arabic to English for a
Jordanian tools catalog. These are trade names: prefer the term a tool catalogue
would print (e.g. "زرادية" -> "Pliers", "بكس" -> "Socket", "شق رنق" -> "Circlip Pliers").
Keep sizes, inch marks, and numbers exactly as they appear.

Return ONLY a JSON object mapping each product code (as a string) to its English
name. No markdown, no commentary.

Products:
{items}
"""


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def validate_names(products: list[dict], names: dict) -> None:
    """Raise ValueError if any product lacks a non-empty English name."""
    missing = [p["code"] for p in products
               if not (names.get(str(p["code"])) or "").strip()]
    if missing:
        raise ValueError(f"{len(missing)} product(s) have no English name: "
                         f"{missing[:10]}")


def _load_cache() -> dict:
    if os.path.exists(OUT_PATH):
        return json.load(open(OUT_PATH, encoding="utf-8"))
    return {}


def main():
    products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    names = _load_cache()
    todo = [p for p in products if not (names.get(str(p["code"])) or "").strip()]
    print(f"{len(products)} products, {len(names)} already translated, {len(todo)} to go")
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    for i, batch in enumerate(chunked(todo, BATCH), 1):
        items = "\n".join(f'{p["code"]}: {p["name_ar"]}' for p in batch)
        names.update(call_json(llm, PROMPT.format(items=items)))
        save_json(OUT_PATH, names)  # cache after every batch: a crash resumes, not restarts
        print(f"batch {i}: {len(names)}/{len(products)} translated")
    validate_names(products, names)
    save_json(OUT_PATH, names)
    print(f"wrote {len(names)} English names to {OUT_PATH}")


if __name__ == "__main__":
    main()
