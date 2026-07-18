import tools


def test_format_tavily_dict_with_results():
    res = {"results": [{"title": "About", "url": "https://x/a", "content": "hi"}]}
    out = tools._format_tavily(res)
    assert "About" in out and "https://x/a" in out and "hi" in out


def test_format_tavily_plain_string_does_not_crash():
    # Tavily returns a bare string when it finds nothing — must not raise.
    out = tools._format_tavily("No search results found for 'xyz'")
    assert "No search results found for 'xyz'" in out


def test_format_tavily_empty_and_none():
    assert "No results" in tools._format_tavily({})
    assert "No results" in tools._format_tavily([])
    assert "No results" in tools._format_tavily(None)
    assert "No results" in tools._format_tavily("")
