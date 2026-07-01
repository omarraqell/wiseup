import tools


class _FakeLLM:
    def __init__(self, content):
        self._content = content
    def invoke(self, messages):
        class R:  # minimal .content carrier
            pass
        r = R()
        r.content = self._content
        return r


def test_collect_images_gathers_top_and_per_result():
    res = {"images": ["https://x/a.png"],
           "results": [{"images": ["https://x/b.png"]}, {"url": "https://x/c"}]}
    imgs = tools._collect_images(res)
    assert "https://x/a.png" in imgs and "https://x/b.png" in imgs


def test_strip_fences_unwraps_json_block():
    assert tools._strip_fences('```json\n[1,2]\n```') == "[1,2]"
    assert tools._strip_fences('[1,2]') == "[1,2]"


def test_extract_web_products_parses_llm_json(monkeypatch):
    monkeypatch.setattr(tools, "_web_llm", lambda: _FakeLLM(
        '[{"name":"Screwdriver","price":1.5,"image_url":"https://x/s.png","source_url":"https://x/p"}]'))
    res = {"results": [{"url": "https://x/p", "raw_content": "screwdriver",
                        "images": ["https://x/s.png"]}]}
    recs = tools._extract_web_products(res, "screwdriver")
    assert recs == [{"name": "Screwdriver", "price": 1.5,
                     "image_url": "https://x/s.png", "source_url": "https://x/p"}]


def test_extract_web_products_bad_json_returns_empty(monkeypatch):
    monkeypatch.setattr(tools, "_web_llm", lambda: _FakeLLM("not json at all"))
    res = {"results": [{"url": "https://x/p", "raw_content": "x"}]}
    assert tools._extract_web_products(res, "q") == []


def test_extract_web_products_string_or_empty_res_returns_empty():
    assert tools._extract_web_products("No search results found", "q") == []
    assert tools._extract_web_products(None, "q") == []


def test_to_web_card_maps_fields_and_missing_price():
    card = tools.to_web_card(
        {"name": "Pliers", "price": None, "image_url": "https://x/p.png",
         "source_url": "https://x/pl"}, 80)
    assert card["name_ar"] == "Pliers"
    assert card["price_jod"] is None
    assert card["image_url"] == "https://x/p.png"      # absolute, passthrough
    assert card["source_url"] == "https://x/pl"
    assert card["code"] == "" and card["unit"] == ""
    assert card["relevance"] == 80
