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


from langgraph.types import Command


def test_browse_returns_command_with_web_cards(monkeypatch):
    monkeypatch.setattr(tools, "_get_crawler",
                        lambda: type("C", (), {"invoke": lambda self, p: {"results": [{"url": "u"}]}})())
    monkeypatch.setattr(tools, "_extract_web_products", lambda res, q: [
        {"name": "Screwdriver", "price": None,
         "image_url": "https://x/s.png", "source_url": "https://x/p"}])

    cmd = tools.browse_wiseup_website.func(query="screwdriver", tool_call_id="t1")

    assert isinstance(cmd, Command)
    card = cmd.update["retrieved_products"][0]
    assert card["name_ar"] == "Screwdriver"
    assert card["image_url"] == "https://x/s.png"
    assert card["price_jod"] is None and card["code"] == ""
    assert cmd.update["messages"][0].tool_call_id == "t1"


def test_browse_no_products_does_not_wipe_cards(monkeypatch):
    monkeypatch.setattr(tools, "_get_crawler",
                        lambda: type("C", (), {"invoke": lambda self, p: {"results": []}})())
    monkeypatch.setattr(tools, "_extract_web_products", lambda res, q: [])

    cmd = tools.browse_wiseup_website.func(query="nothing", tool_call_id="t2")

    assert "retrieved_products" not in cmd.update            # existing cards preserved
    assert cmd.update["messages"][0].tool_call_id == "t2"
    assert "couldn't find" in cmd.update["messages"][0].content.lower()


def test_browse_crawler_exception_is_handled(monkeypatch):
    def boom():
        class C:
            def invoke(self, p): raise RuntimeError("crawl failed")
        return C()
    monkeypatch.setattr(tools, "_get_crawler", boom)

    cmd = tools.browse_wiseup_website.func(query="q", tool_call_id="t3")
    assert "retrieved_products" not in cmd.update
    assert cmd.update["messages"][0].tool_call_id == "t3"


def test_tools_list_swapped():
    names = [t.name for t in tools.TOOLS]
    assert "browse_wiseup_website" in names
    assert "search_wiseup_web" not in names


def test_browse_does_not_pass_format_to_invoke(monkeypatch):
    seen = {}
    class C:
        def invoke(self, p):
            seen.update(p)
            return {"results": [{"url": "u", "raw_content": "x"}]}
    monkeypatch.setattr(tools, "_get_crawler", lambda: C())
    monkeypatch.setattr(tools, "_extract_web_products", lambda res, q: [])
    tools.browse_wiseup_website.func(query="q", tool_call_id="t")
    assert "format" not in seen                       # format is constructor-only
    assert seen["url"] == tools.SITE_URL and seen["max_depth"] == 2 and seen["limit"] == 15


def test_to_web_card_price_coerced_to_number_or_none():
    assert tools.to_web_card({"name": "X", "price": 2.5}, 90)["price_jod"] == 2.5
    assert tools.to_web_card({"name": "X", "price": 3}, 90)["price_jod"] == 3
    # non-numeric (e.g. an injected string) or bool -> None
    assert tools.to_web_card({"name": "X", "price": "<img onerror=alert(1)>"}, 90)["price_jod"] is None
    assert tools.to_web_card({"name": "X", "price": True}, 90)["price_jod"] is None
    assert tools.to_web_card({"name": "X"}, 90)["price_jod"] is None
