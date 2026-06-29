from langchain_core.documents import Document
import tools


def test_to_card_maps_metadata_and_image():
    doc = Document(page_content="x", metadata={
        "item_no": "010801", "product_name": "Circlip Pliers",
        "series": "Pliers Series", "size": "7\"/175MM",
        "image": "images\\p1.png"})
    card = tools.to_card(doc, 0.4)
    assert card["item_no"] == "010801"
    assert card["product_name"] == "Circlip Pliers"
    assert card["image_url"] == "/images/p1.png"
    assert 5 <= card["relevance"] <= 100


def test_lookup_products_returns_known_item():
    import json
    rows = json.load(open("products.json", encoding="utf-8"))
    code = str(rows[0]["code"])
    found = tools._lookup_products([code])
    assert found and str(found[0]["code"]) == code
