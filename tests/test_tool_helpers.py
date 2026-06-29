from langchain_core.documents import Document
import tools


def test_to_card_maps_new_schema_and_image():
    doc = Document(page_content="x", metadata={
        "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
        "price_jod": 2.5, "image": "images/10101.png"})
    card = tools.to_card(doc, 0.4)
    assert card["code"] == "10101"
    assert card["name_ar"].startswith("زرادية")
    assert card["price_jod"] == 2.5
    assert card["unit"] == "pcs"
    assert card["image_url"] == "/images/10101.png"
    assert 5 <= card["relevance"] <= 100


def test_lookup_products_returns_known_item():
    import json
    rows = json.load(open("products.json", encoding="utf-8"))
    code = str(rows[0]["code"])
    found = tools._lookup_products([code])
    assert found and str(found[0]["code"]) == code
