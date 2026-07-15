"""One-shot: assign each of the 633 products to exactly one crawled category.

Products are sent to the LLM grouped by code prefix, so sibling products land in
the same series. The prefix is a hint, not the decision — prefix group 17 alone
lumps 124 unrelated items (see the spec's "Category derivation").
Cached to data/assignments.json per group so an interrupted run resumes.
"""
import json
import os
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from scripts._llm import call_json, save_json

PRODUCTS_PATH = "products.json"
CATEGORIES_PATH = "data/categories.json"
NAMES_PATH = "data/names_en.json"
OUT_PATH = "data/assignments.json"

PROMPT = """You are cataloguing a Jordanian hand-tool inventory.

Assign every product below to exactly ONE category id from this list:
{categories}

These products share an internal code prefix, which usually — but NOT always —
means they belong to the same series. Judge each product by its name. If a product
clearly belongs to a different series than its neighbours, put it there.

Return ONLY a JSON object mapping each product code (as a string) to its chosen
category id (an integer). Every code must appear. No markdown, no commentary.

Products:
{items}
"""


def prefix_of(code: str) -> str:
    return str(code)[:2]


def group_by_prefix(products: list[dict]) -> dict:
    groups = defaultdict(list)
    for p in products:
        groups[prefix_of(p["code"])].append(p)
    return dict(groups)


def validate_assignments(products: list[dict], assignments: dict,
                         valid_ids: set) -> None:
    """Raise ValueError if any product is unassigned or points at an unknown category."""
    missing = [p["code"] for p in products if str(p["code"]) not in assignments]
    if missing:
        raise ValueError(f"{len(missing)} product(s) unassigned: {missing[:10]}")
    bad = {c: cid for c, cid in assignments.items() if cid not in valid_ids}
    if bad:
        raise ValueError(f"{len(bad)} assignment(s) use unknown category ids: "
                         f"{dict(list(bad.items())[:10])}")


def main():
    products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    categories = json.load(open(CATEGORIES_PATH, encoding="utf-8"))
    names_en = json.load(open(NAMES_PATH, encoding="utf-8"))
    valid_ids = {c["id"] for c in categories}
    cat_list = "\n".join(f'{c["id"]}: {c["name_en"]}' for c in categories)

    assignments = json.load(open(OUT_PATH, encoding="utf-8")) if os.path.exists(OUT_PATH) else {}
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    for prefix, group in sorted(group_by_prefix(products).items()):
        if all(str(p["code"]) in assignments for p in group):
            continue
        items = "\n".join(
            f'{p["code"]}: {names_en.get(str(p["code"]), "")} | {p["name_ar"]}'
            for p in group)
        reply = call_json(llm, PROMPT.format(categories=cat_list, items=items))
        assignments.update({str(k): int(v) for k, v in reply.items()})
        save_json(OUT_PATH, assignments)  # cache per group: a crash resumes, not restarts
        print(f"prefix {prefix}: {len(group)} product(s) → "
              f"{len(assignments)}/{len(products)} assigned")

    validate_assignments(products, assignments, valid_ids)
    save_json(OUT_PATH, assignments)
    print(f"wrote {len(assignments)} assignments to {OUT_PATH}")


if __name__ == "__main__":
    main()
