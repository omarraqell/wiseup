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


import pytest
from scripts._llm import call_json, save_json
from scripts.translate_categories import merge_translations


class _FakeLLM:
    def __init__(self, content):
        self._content = content

    def invoke(self, _prompt):
        return type("R", (), {"content": self._content})()


def test_call_json_parses_a_plain_json_reply():
    assert call_json(_FakeLLM('{"5": "أ"}'), "p") == {"5": "أ"}


def test_call_json_parses_a_markdown_fenced_reply():
    assert call_json(_FakeLLM('```json\n{"5": "أ"}\n```'), "p") == {"5": "أ"}


def test_call_json_parses_a_bare_fenced_reply():
    assert call_json(_FakeLLM('```\n{"5": "أ"}\n```'), "p") == {"5": "أ"}


def test_save_json_round_trips_arabic_unescaped(tmp_path):
    target = tmp_path / "sub" / "out.json"
    save_json(str(target), {"5": "زرادية"})
    assert "زرادية" in target.read_text(encoding="utf-8")


def test_merge_translations_attaches_arabic_by_id():
    raw = [{"id": 5, "name_en": "Pliers series", "url": "u"}]
    out = merge_translations(raw, {"5": "سلسلة الزراديات"})
    assert out == [{"id": 5, "name_en": "Pliers series", "url": "u",
                    "name_ar": "سلسلة الزراديات"}]


def test_merge_translations_raises_on_missing_translation():
    raw = [{"id": 5, "name_en": "Pliers series", "url": "u"},
           {"id": 6, "name_en": "Measurement series", "url": "u2"}]
    with pytest.raises(ValueError, match="6"):
        merge_translations(raw, {"5": "سلسلة الزراديات"})


from scripts.translate_products import chunked, validate_names


def test_chunked_splits_evenly_and_keeps_remainder():
    assert list(chunked([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]


def test_validate_names_passes_when_every_code_has_a_name():
    products = [{"code": "10101", "name_ar": "زرادية"}]
    validate_names(products, {"10101": "Pliers"})


def test_validate_names_raises_on_missing_code():
    products = [{"code": "10101", "name_ar": "زرادية"},
                {"code": "10102", "name_ar": "بكس"}]
    with pytest.raises(ValueError, match="10102"):
        validate_names(products, {"10101": "Pliers"})


def test_validate_names_raises_on_blank_name():
    products = [{"code": "10101", "name_ar": "زرادية"}]
    with pytest.raises(ValueError, match="10101"):
        validate_names(products, {"10101": "   "})


from scripts.assign_categories import prefix_of, group_by_prefix, validate_assignments


def test_prefix_of_takes_first_two_characters():
    assert prefix_of("10101") == "10"
    assert prefix_of("B1234") == "B1"


def test_prefix_of_handles_short_codes():
    assert prefix_of("7") == "7"


def test_group_by_prefix_buckets_products():
    products = [{"code": "10101"}, {"code": "10999"}, {"code": "64001"}]
    groups = group_by_prefix(products)
    assert [p["code"] for p in groups["10"]] == ["10101", "10999"]
    assert [p["code"] for p in groups["64"]] == ["64001"]


def test_validate_assignments_passes_when_all_assigned_to_known_ids():
    validate_assignments([{"code": "10101"}], {"10101": 5}, {5, 6})


def test_validate_assignments_raises_on_unassigned_product():
    with pytest.raises(ValueError, match="10102"):
        validate_assignments([{"code": "10101"}, {"code": "10102"}],
                             {"10101": 5}, {5, 6})


def test_validate_assignments_raises_on_unknown_category_id():
    with pytest.raises(ValueError, match="99"):
        validate_assignments([{"code": "10101"}], {"10101": 99}, {5, 6})
