"""Apply the hand-written Arabic glossary to products.json (no API calls).

Produces products_bilingual.json with parallel Arabic fields. Terms not in the
glossary (numbers, model codes, OCR noise) fall through to their original value.
"""
import json

products = json.load(open("products.json", encoding="utf-8"))
g = json.load(open("kb_ar_glossary.json", encoding="utf-8"))


def tr(v):
    v = (v or "").strip()
    return g.get(v, v)


def describe_ar(p):
    name = tr(p.get("product_name")) or "منتج"
    series = tr(p.get("series"))
    parts = [f"{name} — {series}".strip(" —")]
    mat = tr(p.get("material"))
    if mat:                   parts.append(f"المادة: {mat}.")
    if p.get("size"):         parts.append(f"المقاس: {p['size']}.")
    if p.get("packing"):      parts.append(f"التغليف: {p['packing']}.")
    if p.get("gross_weight"): parts.append(f"الوزن الإجمالي: {p['gross_weight']}.")
    if p.get("cbm"):          parts.append(f"الحجم CBM: {p['cbm']}.")
    parts.append(f"رقم الصنف: {p['item_no']}.")
    return " ".join(parts)


translated = 0
for p in products:
    p["product_name_ar"] = tr(p.get("product_name"))
    p["series_ar"] = tr(p.get("series"))
    p["material_ar"] = tr(p.get("material"))
    p["description_ar"] = describe_ar(p)
    if p["product_name_ar"] != (p.get("product_name") or "").strip():
        translated += 1

json.dump(products, open("products_bilingual.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(f"Wrote products_bilingual.json | {translated}/{len(products)} rows got a translated product name.")
