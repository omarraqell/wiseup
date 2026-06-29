import tools


def _fake_smtp(sent):
    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def login(self, user, pw): sent["login"] = (user, pw)
        def send_message(self, msg):
            sent["body"] = msg.get_content()
            sent["to"] = msg["To"]
            sent["subject"] = msg["Subject"]
    return FakeSMTP


def test_email_owner_happy_path(monkeypatch):
    sent = {}
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "test-pass")
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", _fake_smtp(sent))
    monkeypatch.setattr(tools, "_lookup_products",
        lambda ids: [{"item_no": "010801", "product_name": "Circlip Pliers",
                      "size": "7\"/175MM", "material": "55# steel"}])
    result = tools.email_owner.func(
        item_nos=["010801"], customer_name="Omar",
        customer_phone="0790000000", customer_email="o@x.com",
        customer_message="I want this")
    assert "Sent 1" in result
    assert sent["login"] == (tools.OWNER_EMAIL, "test-pass")
    assert sent["to"] == tools.OWNER_EMAIL
    b = sent["body"]
    assert "Omar" in b and "0790000000" in b and "o@x.com" in b
    assert "010801" in b and "Circlip Pliers" in b and "I want this" in b


def test_email_owner_missing_contact_does_not_send(monkeypatch):
    used = {"smtp": False}
    class Guard:
        def __init__(self, *a, **k): used["smtp"] = True
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", Guard)
    result = tools.email_owner.func(
        item_nos=["010801"], customer_name="Omar",
        customer_phone="", customer_email="", customer_message="hi")
    assert "Missing contact" in result
    assert used["smtp"] is False


def test_email_owner_single_item(monkeypatch):
    sent = {}
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "p")
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", _fake_smtp(sent))
    monkeypatch.setattr(tools, "_lookup_products",
        lambda ids: [{"item_no": "010801", "product_name": "Circlip Pliers",
                      "size": "7\"", "material": "steel"}])
    result = tools.email_owner.func(
        item_nos=["010801"], customer_name="Omar", customer_email="o@x.com")
    assert "Sent 1" in result
    assert sent["body"].count("item_no:") == 1


def test_email_owner_unknown_items_sends_nothing(monkeypatch):
    used = {"smtp": False}
    class Guard:
        def __init__(self, *a, **k): used["smtp"] = True
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "p")
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", Guard)
    monkeypatch.setattr(tools, "_lookup_products", lambda ids: [])
    result = tools.email_owner.func(
        item_nos=["999999"], customer_name="Omar", customer_email="o@x.com")
    assert "nothing sent" in result
    assert used["smtp"] is False
