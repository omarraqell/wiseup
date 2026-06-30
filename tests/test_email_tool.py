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
        lambda ids: [{"code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"",
                      "unit": "pcs", "price_jod": 2.5}])
    result = tools.email_owner.func(
        item_nos=["10101"], customer_name="Omar",
        customer_phone="0790000000", customer_email="o@x.com",
        customer_message="بدي هاي")
    assert "Sent 1" in result
    assert sent["login"] == (tools.OWNER_EMAIL, "test-pass")
    b = sent["body"]
    assert "Omar" in b and "0790000000" in b and "o@x.com" in b
    assert "10101" in b and "زرادية" in b
    assert "2.5" in b and "JOD" in b          # price shown
    assert "Total" in b                        # total line present


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
        lambda ids: [{"code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"",
                      "unit": "pcs", "price_jod": 2.5}])
    result = tools.email_owner.func(
        item_nos=["10101"], customer_name="Omar", customer_email="o@x.com")
    assert "Sent 1" in result
    assert sent["body"].count("10101") == 1


def test_email_owner_bad_phone_does_not_send(monkeypatch):
    used = {"smtp": False}
    class Guard:
        def __init__(self, *a, **k): used["smtp"] = True
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", Guard)
    result = tools.email_owner.func(
        item_nos=["10101"], customer_name="Omar",
        customer_phone="0712345678", customer_email="")   # 071 is not a mobile prefix
    assert "phone" in result.lower()
    assert used["smtp"] is False


def test_email_owner_bad_email_does_not_send(monkeypatch):
    used = {"smtp": False}
    class Guard:
        def __init__(self, *a, **k): used["smtp"] = True
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", Guard)
    result = tools.email_owner.func(
        item_nos=["10101"], customer_name="Omar",
        customer_phone="", customer_email="omar-at-x.com")  # no @
    assert "email" in result.lower()
    assert used["smtp"] is False


def test_email_owner_accepts_077_078_079(monkeypatch):
    for phone in ("0771234567", "0781234567", "0791234567"):
        sent = {}
        monkeypatch.setenv("GMAIL_APP_PASSWORD", "p")
        monkeypatch.setattr(tools.smtplib, "SMTP_SSL", _fake_smtp(sent))
        monkeypatch.setattr(tools, "_lookup_products",
            lambda ids: [{"code": "10101", "name_ar": "x", "unit": "pcs", "price_jod": 2.5}])
        result = tools.email_owner.func(
            item_nos=["10101"], customer_name="Omar", customer_phone=phone)
        assert "Sent 1" in result, phone


def test_email_owner_schema_pattern_rejects_bad_phone(monkeypatch):
    # The Pydantic args schema (used by ToolNode in production) rejects a bad phone
    # BEFORE the body runs. Mock SMTP+env so the only failure source is the pattern.
    from pydantic import ValidationError
    import pytest
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "p")
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", _fake_smtp({}))
    monkeypatch.setattr(tools, "_lookup_products",
        lambda ids: [{"code": "10101", "name_ar": "x", "unit": "pcs", "price_jod": 2.5}])
    with pytest.raises(ValidationError):
        tools.email_owner.invoke(
            {"item_nos": ["10101"], "customer_name": "Omar",
             "customer_phone": "0712345678"})


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
