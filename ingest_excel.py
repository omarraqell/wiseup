"""Turn the WISEUP Excel price list into products.json + extracted product images.

Source: data/wiseup_prices.xlsx (cols: A الرقم, B الصورة, C الكود, D الصنف, E Unit, F السعر).
Images are embedded in the الصورة column; we extract each to images/<code>.png.
"""
import json
import os
import shutil
import openpyxl

SRC = "data/wiseup_prices.xlsx"
IMG_DIR = "images"
OUT = "products.json"


def is_product(name, price) -> bool:
    """A data row is a product when it has a non-empty name and a numeric price.
    This filters out the header row (price == 'السعر') and blank/separator rows."""
    return bool(name and str(name).strip()) and isinstance(price, (int, float))


def main():
    wb = openpyxl.load_workbook(SRC)  # NOT read_only, so embedded images load
    ws = wb["Sheet1"]
    products = []
    row_code = {}  # 1-based sheet row -> code
    for row in ws.iter_rows(min_row=2):
        code, name, unit, price = row[2].value, row[3].value, row[4].value, row[5].value
        if not is_product(name, price):
            continue
        if code is None or not str(code).strip():
            continue  # a product must have a code
        code = str(code).strip()
        products.append({
            "code": code,
            "name_ar": str(name).strip(),
            "unit": str(unit).strip() if unit else "",
            "price_jod": float(price),
            "image": "",
        })
        row_code[row[0].row] = code

    if os.path.isdir(IMG_DIR):
        shutil.rmtree(IMG_DIR)
    os.makedirs(IMG_DIR, exist_ok=True)

    by_code = {p["code"]: p for p in products}
    saved = 0
    for img in getattr(ws, "_images", []):
        sheet_row = img.anchor._from.row + 1  # anchor row is 0-based
        code = row_code.get(sheet_row)
        if not code:
            continue
        p = by_code[code]
        if p["image"]:
            continue  # keep the first image per product
        safe_code = code.replace("/", "_").replace("\\", "_")
        with open(os.path.join(IMG_DIR, f"{safe_code}.png"), "wb") as f:
            f.write(img._data())
        p["image"] = f"{IMG_DIR}/{safe_code}.png"
        saved += 1

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    without = sum(1 for p in products if not p["image"])
    print(f"products: {len(products)}  images saved: {saved}  without image: {without}")


if __name__ == "__main__":
    main()
