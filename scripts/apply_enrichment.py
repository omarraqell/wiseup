"""One-shot: merge names_en + assignments into products.json.

Additive and atomic. products.json is the only copy of the catalog: this script
either rewrites it completely and correctly, or leaves it exactly as it was.
"""
import json
import os
import shutil
import tempfile

PRODUCTS_PATH = "products.json"
NAMES_PATH = "data/names_en.json"
ASSIGNMENTS_PATH = "data/assignments.json"
BACKUP_PATH = "data/products.backup.json"


def enrich(products: list[dict], names_en: dict, assignments: dict) -> list[dict]:
    """Return products with name_en and category_id added. Raises if anything is missing."""
    out = []
    for p in products:
        code = str(p["code"])
        name_en = (names_en.get(code) or "").strip()
        cat_id = assignments.get(code)
        if not name_en:
            raise ValueError(f"product {code} has no English name")
        if cat_id is None:
            raise ValueError(f"product {code} has no category assignment")
        out.append({**p, "name_en": name_en, "category_id": int(cat_id)})
    return out


def write_atomic(path: str, data) -> None:
    """Serialize fully to a temp file, then replace. A failure leaves `path` untouched."""
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def main():
    products = json.load(open(PRODUCTS_PATH, encoding="utf-8"))
    names_en = json.load(open(NAMES_PATH, encoding="utf-8"))
    assignments = json.load(open(ASSIGNMENTS_PATH, encoding="utf-8"))
    before = len(products)

    os.makedirs("data", exist_ok=True)
    shutil.copyfile(PRODUCTS_PATH, BACKUP_PATH)

    enriched = enrich(products, names_en, assignments)
    if len(enriched) != before:
        raise ValueError(f"product count changed: {before} -> {len(enriched)}")

    write_atomic(PRODUCTS_PATH, enriched)
    print(f"enriched {len(enriched)} products (backup at {BACKUP_PATH})")


if __name__ == "__main__":
    main()
