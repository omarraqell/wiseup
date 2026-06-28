# Email Lead-Capture + Card-Aligned Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `email_owner` tool to capture a customer lead (name + phone/email, bulk or single item) sent on an explicit "yes", and make catalog replies card-aligned (short intro, no markdown asterisks) with a UI safeguard.

**Architecture:** No graph topology change. Modify the `email_owner` tool and `_format_email` in `tools.py`; update `SYSTEM_PROMPT` in `agent_graph.py`; add a `stripMarkdown` sanitizer in `frontend/index.html`. Tests are pytest with mocked SMTP.

**Tech Stack:** Python 3.14, LangGraph, langchain-core, FastAPI, pytest, vanilla JS. Windows / PowerShell. Branch `feature/email-lead-capture`.

## Global Constraints

- Branch: `feature/email-lead-capture` (already checked out off `master`).
- `email_owner` requires `customer_name` AND at least one of `customer_phone` / `customer_email`; otherwise it returns a guidance string and does NOT send.
- Email tool sends only AFTER the customer gives contact details AND replies "yes" (explicit-yes flow lives in `SYSTEM_PROMPT`).
- `item_nos` is a list — supports bulk (many) or single (one) → one combined email.
- Product details come from `products.json` via `_lookup_products` — never LLM memory.
- Owner email constant `OWNER_EMAIL = "omaraqel270@gmail.com"`; send From/To owner via `smtplib.SMTP_SSL("smtp.gmail.com", 465)`; password from `os.environ["GMAIL_APP_PASSWORD"]`.
- Card-aligned replies: when products are returned, the agent must NOT enumerate products in text, NOT use markdown bold/asterisks (`**`) or numbered/bulleted product lists.
- No real secret values in any committed file or test (tests use dummy passwords).
- Full suite must stay green: `python -m pytest -q`.

---

## File Structure

| File | Change |
|---|---|
| `tools.py` | Modify `email_owner` (new signature + contact validation) and `_format_email` (lead body). Keep `OWNER_EMAIL`, `_lookup_products`, logging. |
| `agent_graph.py` | Replace `SYSTEM_PROMPT` (card-aligned reply rules + contact-collection + explicit-yes flow). |
| `frontend/index.html` | Add `stripMarkdown(s)` helper (after `linkifyCodes`, line ~165) and apply it to `data.answer` before render (line ~207). |
| `tests/test_email_tool.py` | Replace with 4 tests for the new signature/validation. |
| `tests/test_system_prompt.py` | New — assert the prompt contains the card + lead rules. |

---

## Task 1: `email_owner` lead-capture (tools.py)

**Files:**
- Modify: `tools.py` (the `_format_email` function and the `email_owner` tool)
- Test: `tests/test_email_tool.py` (replace existing content)

**Interfaces:**
- Consumes: `_lookup_products(item_nos) -> list[dict]`, `OWNER_EMAIL`, `smtplib`, env `GMAIL_APP_PASSWORD`
- Produces:
  - `_format_email(products, customer_name, customer_phone, customer_email, customer_message) -> str`
  - `email_owner(item_nos: list[str], customer_name: str, customer_phone: str = "", customer_email: str = "", customer_message: str = "") -> str`

- [ ] **Step 1: Replace the test file** `tests/test_email_tool.py` with:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_email_tool.py -v`
Expected: FAIL — `email_owner.func()` got an unexpected/missing keyword (old signature took `customer_message` positionally, no `customer_name`).

- [ ] **Step 3: Replace `_format_email` in `tools.py`**

Find the current `_format_email` (it takes `(products, customer_message)`) and replace the whole function with:

```python
def _format_email(products, customer_name, customer_phone, customer_email, customer_message) -> str:
    lines = [
        "New customer lead",
        f"Name:  {customer_name}",
        f"Phone: {customer_phone or '—'}",
        f"Email: {customer_email or '—'}",
        "",
        f"Interested in ({len(products)} product(s)):",
    ]
    for p in products:
        lines.append(
            f"- {p.get('product_name','Product')} | item_no: {p.get('item_no','')} | "
            f"size: {p.get('size','')} | material: {p.get('material','')} | "
            f"packing: {p.get('packing','')}")
    lines += ["", f"Message: {customer_message or '(none)'}"]
    return "\n".join(lines)
```

- [ ] **Step 4: Replace the `email_owner` tool in `tools.py`**

Replace the whole `email_owner` function (keep its `@tool` decorator) with:

```python
@tool
def email_owner(item_nos: list[str], customer_name: str,
                customer_phone: str = "", customer_email: str = "",
                customer_message: str = "") -> str:
    """Email the customer's selected products and contact details to the WISEUP owner as a
    lead. Requires the customer's name and at least one of phone or email. Call ONLY after
    the customer has given their contact details AND explicitly confirmed (said yes)."""
    log(f"🔧 TOOL email_owner(item_nos={item_nos}, name={customer_name!r})")
    if not customer_name.strip() or not (customer_phone.strip() or customer_email.strip()):
        log("🔧 TOOL email_owner → missing contact info; nothing sent")
        return ("Missing contact info: I need the customer's name and at least a phone "
                "number or an email address before sending.")
    products = _lookup_products(item_nos)
    if not products:
        log("🔧 TOOL email_owner → no matching item numbers; nothing sent")
        return "No matching products found for those item numbers; nothing sent."
    msg = EmailMessage()
    msg["Subject"] = f"New customer lead - {len(products)} product(s) from {customer_name}"
    msg["From"] = OWNER_EMAIL
    msg["To"] = OWNER_EMAIL
    msg.set_content(_format_email(products, customer_name, customer_phone,
                                  customer_email, customer_message))
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(OWNER_EMAIL, os.environ["GMAIL_APP_PASSWORD"])
        s.send_message(msg)
    log(f"🔧 TOOL email_owner → sent {len(products)} product(s) to {OWNER_EMAIL}")
    return f"Sent {len(products)} product(s) to the owner."
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python -m pytest tests/test_email_tool.py -v`
Expected: PASS (4 passed).

- [ ] **Step 6: Run the full suite**

Run: `python -m pytest -q`
Expected: all pass except the opt-in live test which SKIPS.

- [ ] **Step 7: Commit**

```bash
git add tools.py tests/test_email_tool.py
git commit -m "feat: email_owner captures customer lead (name + phone/email, bulk or single)"
```

---

## Task 2: Card-aligned + lead-capture system prompt (agent_graph.py)

**Files:**
- Modify: `agent_graph.py` (the `SYSTEM_PROMPT` string)
- Test: `tests/test_system_prompt.py` (new)

**Interfaces:**
- Consumes: nothing new
- Produces: updated `SYSTEM_PROMPT` containing the card-aligned reply rules and the
  name/phone/email + explicit-yes flow.

- [ ] **Step 1: Write the failing test** `tests/test_system_prompt.py`:

```python
import agent_graph


def test_system_prompt_has_card_rules():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "card" in p                       # tells the model the UI shows cards
    assert "asterisk" in p or "**" in p      # forbids markdown bold


def test_system_prompt_has_lead_capture_rules():
    p = agent_graph.SYSTEM_PROMPT.lower()
    assert "name" in p and "phone" in p and "email" in p
    assert "yes" in p                        # explicit confirmation before sending
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_system_prompt.py -v`
Expected: FAIL — current prompt has no "card"/"asterisk"/"phone"/"email" wording.

- [ ] **Step 3: Replace `SYSTEM_PROMPT` in `agent_graph.py`** with:

```python
SYSTEM_PROMPT = """You are the WISEUP tools catalog assistant, a friendly B2B assistant \
for a hand-tools and power-tools brand.

Tools you can use:
- retrieve_products: search the local product catalog. Use for any question about specific \
tools, sizes, materials, item numbers, or what is available.
- search_wiseup_web: search the official WISEUP website (wiseuptools.com). Use ONLY for \
company/website info that is NOT in the catalog (about the company, contact, certifications).
- email_owner: send the customer's selected products and their contact details to the \
business owner as a lead.

Replying with products (IMPORTANT):
- When retrieve_products returns products, the user interface already shows them as visual \
cards (item number, size, image). Write only a SHORT, friendly intro of 1-2 sentences that \
points to the cards below, e.g. "Here are 8 tapes we carry — details are on the cards below."
- Do NOT list each product in your text. Do NOT use markdown bold or asterisks (**), and do \
NOT output numbered or bulleted product lists. The cards carry the details; your text only \
frames them.

Collecting an order / lead:
- When the customer signals they are finished or ready to proceed/order (any phrasing, e.g. \
"that's all", "I'll take these", "send it over", "we're good"), FIRST ask them in a single \
message for their name, phone number, and email (e.g. "Could I get your name, phone number, \
and email so I can pass this to our team?"). You need their name and at least one of phone or email.
- Once you have valid contact details, ask them to confirm: "Shall I send these N products to \
the owner?" Only call email_owner AFTER they reply yes, passing the item numbers discussed \
plus the collected name, phone, and email.

General:
- Never invent item numbers, products, or contact details.
- Keep replies concise and friendly."""
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_system_prompt.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -q`
Expected: all pass (live test skips). The existing `tests/test_agent_graph.py` must still pass.

- [ ] **Step 6: Commit**

```bash
git add agent_graph.py tests/test_system_prompt.py
git commit -m "feat: card-aligned replies + name/phone/email lead-capture flow in system prompt"
```

---

## Task 3: UI safeguard — strip stray markdown (frontend/index.html)

**Files:**
- Modify: `frontend/index.html` (add `stripMarkdown`, apply it before render)

**Interfaces:**
- Consumes: `linkifyCodes` (existing, line ~165)
- Produces: `stripMarkdown(s) -> string`; answer text rendered through it.

- [ ] **Step 1: Add the `stripMarkdown` helper** immediately AFTER the `linkifyCodes` line (line ~165). The existing line is:

```js
function linkifyCodes(t){ return (t||'').replace(/\b(\d{6})\b/g,'<span class="font-mono bg-white px-1 py-0.5 border border-gray-200 rounded">$1</span>'); }
```

Add directly below it:

```js
function stripMarkdown(s){
  return (s || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')        // **bold** -> bold
    .replace(/(^|\s)\*(\S.*?)\*/g, '$1$2')  // *italic* -> italic
    .replace(/^\s*[-*]\s+/gm, '')           // leading bullet markers
    .replace(/^\s*\d+\.\s+/gm, '');         // leading "1. " numbering
}
```

- [ ] **Step 2: Apply it where the answer is rendered.** Find this line (≈207):

```js
if(data.answer){ $('#answer-panel').classList.remove('hidden'); $('#answer-text').innerHTML = linkifyCodes(data.answer); }
```

Replace the inner render call so the answer is sanitized first:

```js
if(data.answer){ $('#answer-panel').classList.remove('hidden'); $('#answer-text').innerHTML = linkifyCodes(stripMarkdown(data.answer)); }
```

- [ ] **Step 3: Manually verify in the browser** (no JS test harness in this project).

Run (PowerShell), then open http://127.0.0.1:8000:
```powershell
foreach ($l in Get-Content .env) { if ($l -match '^(.*?)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```
Ask: "what tapes do you have?"
Expected: the answer panel shows a SHORT intro with **no** `*`/`**` characters and no per-item numbered list; the product **cards** appear below with item numbers, sizes, and images.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "feat: sanitize stray markdown in answer text so cards stay clean"
```

---

## Self-Review Notes

- **Spec coverage:** Part A prompt (Task 2) ✓; Part A UI safeguard (Task 3) ✓; `email_owner` new signature + validation (Task 1) ✓; lead email body (Task 1) ✓; bulk-or-single (Task 1, list arg + single-item test) ✓; explicit-yes flow (Task 2 prompt) ✓; 4 email tests (Task 1) ✓; acceptance criteria (Tasks 1-3 + manual verify) ✓.
- **Type consistency:** `email_owner(item_nos, customer_name, customer_phone="", customer_email="", customer_message="")` and `_format_email(products, customer_name, customer_phone, customer_email, customer_message)` used identically in Task 1 code and tests. `stripMarkdown`/`linkifyCodes` consistent in Task 3.
- **No placeholders:** every step has full code/commands. No real secrets (tests use "test-pass"/"p").
