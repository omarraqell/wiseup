"""The catalog read layer — and the one place a product becomes JSON.

Every product-serving path (API, agent tools, pages) goes through
serialize_product(). Phase 3 turns `include_price` off for business accounts once,
here. Hiding a price in HTML is not hiding it; the key must never be serialized.
See docs/superpowers/specs/2026-07-14-wiseup-storefront-design.md — "The price rule".
"""
import json

PRODUCTS_PATH = "products.json"
CATEGORIES_PATH = "data/categories.json"

_products = None
_categories = None


def load_products() -> list[dict]:
    global _products
    if _products is None:
        with open(PRODUCTS_PATH, encoding="utf-8") as f:
            _products = json.load(f)
    return _products


def load_categories() -> list[dict]:
    global _categories
    if _categories is None:
        with open(CATEGORIES_PATH, encoding="utf-8") as f:
            _categories = json.load(f)
    return _categories


def serialize_product(p: dict, include_price: bool = True) -> dict:
    """Turn a raw product into its public JSON shape.

    Allowlist, not blocklist: a new column in products.json must be added here
    deliberately before it can reach a browser.
    """
    image = (p.get("image") or "").replace("\\", "/")
    out = {
        "code": str(p.get("code", "")),
        "name_ar": p.get("name_ar", ""),
        "name_en": p.get("name_en", ""),
        "unit": p.get("unit", ""),
        "category_id": p.get("category_id", 0),
        "image_url": ("/" + image.lstrip("/")) if image else "",
    }
    if include_price:
        out["price_jod"] = p.get("price_jod", 0)
    return out


def list_products(category_id: int = None, include_price: bool = True) -> list[dict]:
    products = load_products()
    if category_id is not None:
        products = [p for p in products if p.get("category_id") == category_id]
    return [serialize_product(p, include_price) for p in products]


def get_product(code: str, include_price: bool = True) -> dict:
    for p in load_products():
        if str(p.get("code")) == str(code):
            return serialize_product(p, include_price)
    return None


def list_categories() -> list[dict]:
    counts = {}
    for p in load_products():
        cid = p.get("category_id")
        counts[cid] = counts.get(cid, 0) + 1
    return [{**c, "count": counts.get(c["id"], 0)} for c in load_categories()]
