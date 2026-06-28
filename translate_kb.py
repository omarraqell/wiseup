"""Translate the WISEUP catalog into Arabic, in parallel to English.

Strategy: product_name / series / material values repeat heavily across the
1700 rows, so we translate only the UNIQUE strings once (a glossary). This is
cheap, and guarantees the same English term always maps to the same Arabic term.

Outputs:
  - kb_ar_glossary.json       : {english_term: arabic_term}
  - products_bilingual.json   : products.json + *_ar fields + description_ar

Numbers, units (mm, inch, ", V, RPM), model codes and item numbers are kept
unchanged by the translator.
"""
import json
import os
import time
from openai import OpenAI

MODEL = "gpt-4o-mini"
BATCH = 50

SYS = (
    "You are a professional translator for a B2B hand-tools and power-tools "
    "catalog. Translate each English term into Modern Standard Arabic using "
    "standard industry/hardware tool terminology that a tools merchant in the "
    "Arab market would recognise. Rules: keep brand names, model codes, item "
    "numbers, numbers and units (mm, cm, m, inch, \", V, W, RPM, CBM) EXACTLY "
    "as given; translate only the descriptive words. Return STRICT JSON of the "
    "form {\"items\":[{\"id\":<int>,\"ar\":\"<arabic>\"}]} with one entry per input id."
)


def translate_terms(terms):
    client = OpenAI()
    out = {}
    for i in range(0, len(terms), BATCH):
        chunk = terms[i:i + BATCH]
        payload = {"items": [{"id": j, "en": t} for j, t in enumerate(chunk)]}
        resp = client.chat.completions.create(
            model=MODEL, temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYS},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
        )
        data = json.loads(resp.choices[0].message.content)
        for item in data.get("items", []):
            out[chunk[item["id"]]] = item.get("ar", "").strip()
        print(f"  translated {min(i + BATCH, len(terms))}/{len(terms)}", flush=True)
    return out


def describe_ar(p, g):
    name = g.get(p.get("product_name", ""), p.get("product_name", "")) or "منتج"
    series = g.get(p.get("series", ""), p.get("series", ""))
    parts = [f"{name} — {series}".strip(" —")]
    mat = g.get(p.get("material", ""), p.get("material", ""))
    if mat:                parts.append(f"المادة: {mat}.")
    if p.get("size"):      parts.append(f"المقاس: {p['size']}.")
    if p.get("packing"):   parts.append(f"التغليف: {p['packing']}.")
    if p.get("gross_weight"): parts.append(f"الوزن الإجمالي: {p['gross_weight']}.")
    if p.get("cbm"):       parts.append(f"الحجم CBM: {p['cbm']}.")
    parts.append(f"رقم الصنف: {p['item_no']}.")
    return " ".join(parts)


def main():
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("Set OPENAI_API_KEY first.")
    products = json.load(open("products.json", encoding="utf-8"))

    terms = set()
    for p in products:
        for f in ("product_name", "series", "material"):
            v = (p.get(f) or "").strip()
            if v:
                terms.add(v)
    terms = sorted(terms)
    print(f"Translating {len(terms)} unique terms in batches of {BATCH} ...", flush=True)

    t0 = time.time()
    glossary = translate_terms(terms)
    json.dump(glossary, open("kb_ar_glossary.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"Glossary saved ({len(glossary)} terms) in {time.time()-t0:.0f}s.", flush=True)

    for p in products:
        p["product_name_ar"] = glossary.get((p.get("product_name") or "").strip(), "")
        p["series_ar"] = glossary.get((p.get("series") or "").strip(), "")
        p["material_ar"] = glossary.get((p.get("material") or "").strip(), "")
        p["description_ar"] = describe_ar(p, glossary)

    json.dump(products, open("products_bilingual.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("Wrote products_bilingual.json", flush=True)


if __name__ == "__main__":
    main()
