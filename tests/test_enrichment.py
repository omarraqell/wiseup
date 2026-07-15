from scripts.crawl_categories import parse_categories

SAMPLE_HTML = """
<html><body><ul class="cate">
  <li><a href="/h-pr--0_415_5.html" title="Pliers series">Pliers series</a></li>
  <li><a href="/h-pr--0_415_21.html" title="Wrench series">Wrench series</a></li>
  <li><a href="/h-col-103.html" title="Not a category">Products</a></li>
  <li><a href="/h-pr--0_415_5.html" title="Pliers series">Pliers series</a></li>
</ul></body></html>
"""


def test_parse_categories_extracts_id_name_url():
    cats = parse_categories(SAMPLE_HTML)
    assert {"id": 5, "name_en": "Pliers series",
            "url": "https://www.wiseuptools.com/h-pr--0_415_5.html"} in cats


def test_parse_categories_ignores_non_category_links():
    assert all(c["name_en"] != "Not a category" for c in parse_categories(SAMPLE_HTML))


def test_parse_categories_dedupes_repeated_links():
    cats = parse_categories(SAMPLE_HTML)
    assert len(cats) == 2
    assert [c["id"] for c in cats] == [5, 21]
