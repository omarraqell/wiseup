import pytest
import catalog

P = {"code": "10101", "name_ar": "زرادية", "name_en": "Pliers", "unit": "pcs",
     "price_jod": 2.5, "image": "images/10101.png", "category_id": 5}


def test_serialize_product_includes_price_by_default():
    assert catalog.serialize_product(P)["price_jod"] == 2.5


def test_serialize_product_omits_price_entirely_when_asked():
    out = catalog.serialize_product(P, include_price=False)
    assert "price_jod" not in out, "the key must be absent, not None — DevTools reads None"


def test_serialize_product_exposes_a_web_image_url():
    assert catalog.serialize_product(P)["image_url"] == "/images/10101.png"


def test_serialize_product_normalizes_windows_image_separators():
    out = catalog.serialize_product({**P, "image": "images\\10101.png"})
    assert out["image_url"] == "/images/10101.png"


def test_serialize_product_keeps_both_names_and_the_category():
    out = catalog.serialize_product(P)
    assert out["name_ar"] == "زرادية"
    assert out["name_en"] == "Pliers"
    assert out["category_id"] == 5


def test_serialize_product_never_leaks_unlisted_fields():
    out = catalog.serialize_product({**P, "cost_price": 0.9, "supplier": "secret"})
    assert "cost_price" not in out
    assert "supplier" not in out


def test_list_products_filters_by_category(monkeypatch):
    monkeypatch.setattr(catalog, "load_products",
                        lambda: [P, {**P, "code": "20202", "category_id": 6}])
    assert [p["code"] for p in catalog.list_products(category_id=5)] == ["10101"]


def test_list_products_returns_everything_without_a_filter(monkeypatch):
    monkeypatch.setattr(catalog, "load_products",
                        lambda: [P, {**P, "code": "20202", "category_id": 6}])
    assert len(catalog.list_products()) == 2


def test_list_products_propagates_price_omission(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert all("price_jod" not in p for p in catalog.list_products(include_price=False))


def test_get_product_finds_by_code(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert catalog.get_product("10101")["name_en"] == "Pliers"


def test_get_product_returns_none_for_unknown_code(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert catalog.get_product("99999") is None


def test_get_product_propagates_price_omission(monkeypatch):
    monkeypatch.setattr(catalog, "load_products", lambda: [P])
    assert "price_jod" not in catalog.get_product("10101", include_price=False)


def test_list_categories_counts_products(monkeypatch):
    monkeypatch.setattr(catalog, "load_categories",
                        lambda: [{"id": 5, "name_en": "Pliers series",
                                  "name_ar": "الزراديات", "url": "u"}])
    monkeypatch.setattr(catalog, "load_products", lambda: [P, {**P, "code": "10102"}])
    assert catalog.list_categories()[0]["count"] == 2


def test_the_real_catalog_loads_and_every_product_serializes():
    products = catalog.list_products()
    assert len(products) == 632
    assert all(p["name_en"] for p in products)
    # 81006 (قاعدة لفل) has no source image — an owner-accepted gap ("Known
    # follow-ups"). Pin it exactly so any OTHER product losing its image fails.
    assert [p["code"] for p in products if not p["image_url"]] == ["81006"]


def test_the_real_catalog_has_unique_codes():
    # get_product() returns the first match, so a duplicate code silently shadows a
    # product. One duplicate (81103) already shipped and was removed by hand in Task 4.
    codes = [p["code"] for p in catalog.list_products()]
    assert len(codes) == len(set(codes))


from langchain_core.documents import Document
import tools


def _doc():
    return Document(page_content="زرادية", metadata=dict(P))


def test_to_card_uses_the_serializer_and_keeps_the_relevance_badge():
    card = tools.to_card(_doc(), 95)
    assert card["code"] == "10101"
    assert card["image_url"] == "/images/10101.png"
    assert card["price_jod"] == 2.5
    assert card["relevance"] == 95


def test_to_card_can_omit_the_price_for_phase_3():
    assert "price_jod" not in tools.to_card(_doc(), 95, include_price=False)
