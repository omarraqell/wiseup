import json
from fastapi.testclient import TestClient
import api

client = TestClient(api.app)


def test_categories_endpoint_returns_every_crawled_category():
    # Assert against the crawl artifact, not a hardcoded number: the spec makes the
    # crawl the source of truth for the category count.
    expected = json.load(open("data/categories.json", encoding="utf-8"))
    r = client.get("/api/categories")
    assert r.status_code == 200
    cats = r.json()["categories"]
    assert len(cats) == len(expected)
    assert all({"id", "name_en", "name_ar", "count"} <= set(c) for c in cats)


def test_products_endpoint_returns_the_whole_catalog():
    r = client.get("/api/products")
    assert r.status_code == 200
    assert len(r.json()["products"]) == 632


def test_products_endpoint_filters_by_category():
    cid = client.get("/api/categories").json()["categories"][0]["id"]
    products = client.get(f"/api/products?category_id={cid}").json()["products"]
    assert products, "the first category should not be empty"
    assert all(p["category_id"] == cid for p in products)


def test_product_detail_returns_the_product():
    code = client.get("/api/products").json()["products"][0]["code"]
    r = client.get(f"/api/products/{code}")
    assert r.status_code == 200
    assert r.json()["code"] == code


def test_product_detail_404s_for_an_unknown_code():
    assert client.get("/api/products/nope-does-not-exist").status_code == 404


def test_storefront_pages_are_served():
    for path in ["/", "/catalog", "/category", "/product"]:
        assert client.get(path).status_code == 200, f"{path} did not serve"
