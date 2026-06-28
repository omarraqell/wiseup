import tools


def test_email_owner_sends_and_includes_details(monkeypatch):
    sent = {}

    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def login(self, user, pw): sent["login"] = (user, pw)
        def send_message(self, msg): sent["body"] = msg.get_content(); sent["to"] = msg["To"]

    monkeypatch.setenv("GMAIL_APP_PASSWORD", "test-pass")
    monkeypatch.setattr(tools.smtplib, "SMTP_SSL", FakeSMTP)
    # force a known product row
    monkeypatch.setattr(tools, "_lookup_products",
                        lambda ids: [{"item_no": "010801", "product_name": "Circlip Pliers",
                                      "size": "7\"/175MM", "material": "55# steel"}])

    result = tools.email_owner.func(item_nos=["010801"],
                                    customer_message="I want this")
    assert "Sent 1" in result
    assert sent["login"] == (tools.OWNER_EMAIL, "test-pass")
    assert sent["to"] == tools.OWNER_EMAIL
    assert "010801" in sent["body"] and "Circlip Pliers" in sent["body"]
    assert "I want this" in sent["body"]
