import agent_graph


def test_system_prompt_has_card_rules():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "card" in p                       # tells the model the UI shows cards
    assert "asterisk" in p or "**" in p      # forbids markdown bold


def test_system_prompt_has_lead_capture_rules():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "name" in p and "phone" in p and "email" in p
    assert "yes" in p                        # explicit confirmation before sending


def test_system_prompt_mentions_jod_prices():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "jod" in p or "price" in p


def test_system_prompt_scopes_web_crawl():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "browse_wiseup_website" in p
    assert "search_wiseup_web" not in p
    assert "catalog" in p and "first" in p     # catalog-first rule present
