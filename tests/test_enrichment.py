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
