"""Agent tools + shared helpers for the WISEUP agentic RAG."""
import json
import rag

_PRODUCTS = json.load(open("products.json", encoding="utf-8"))
_BY_ITEM = {str(p["item_no"]): p for p in _PRODUCTS if p.get("item_no")}


def to_card(doc, score):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "item_no": m.get("item_no", ""),
        "product_name": m.get("product_name") or "Product",
        "product_name_ar": m.get("product_name_ar", ""),
        "series": m.get("series", ""),
        "series_ar": m.get("series_ar", ""),
        "material": m.get("material", ""),
        "material_ar": m.get("material_ar", ""),
        "size": m.get("size", ""),
        "packing": m.get("packing", ""),
        "gross_weight": m.get("gross_weight", ""),
        "cbm": m.get("cbm", ""),
        "pdf_page": m.get("pdf_page", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        "relevance": max(5, min(100, round((1 - score / 2) * 100))),
    }


def _lookup_products(item_nos):
    return [_BY_ITEM[str(i)] for i in item_nos if str(i) in _BY_ITEM]
