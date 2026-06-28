import tools


def test_search_wiseup_web_formats_results(monkeypatch):
    class FakeTavily:
        def __init__(self, **kw):
            assert kw["include_domains"] == ["wiseuptools.com"]
        def invoke(self, payload):
            return {"results": [
                {"title": "About WISEUP", "url": "https://www.wiseuptools.com/about",
                 "content": "WISEUP makes hand tools."}]}

    monkeypatch.setattr(tools, "TavilySearch", FakeTavily)
    out = tools.search_wiseup_web.func(query="about wiseup")
    assert "About WISEUP" in out
    assert "wiseuptools.com/about" in out
    assert "hand tools" in out
