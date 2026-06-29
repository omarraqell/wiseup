# Email Lead-Capture + Card-Aligned Replies — Design Spec

**Date:** 2026-06-26
**Project:** WISEUP Catalog Assistant (agentic RAG on LangGraph)
**Branch:** `feature/email-lead-capture`
**Status:** Approved design → ready for implementation plan

## 1. Goal

Two related improvements to the existing agentic RAG:

- **Part A — Card-aligned replies:** stop the agent from dumping the product list (with
  markdown `**asterisks**`) into the answer text. The product **cards** carry the detail;
  the answer text should be a short, clean intro that points to them.
- **Part B — Email lead-capture:** upgrade the `email_owner` tool so the agent collects the
  customer's **name, phone, and email**, supports **bulk (a list) or a single item**, and
  emails the owner a structured **lead** — after an explicit customer "yes".

No graph topology change. Only `tools.py`, `agent_graph.py` (prompt), `frontend/index.html`,
and the email tool's tests.

## 2. Part A — Card-aligned replies

### 2.1 Prompt change (`agent_graph.py` `SYSTEM_PROMPT`)
Add a rule:

> When `retrieve_products` returns products, write a SHORT, friendly intro (1–2 sentences)
> that refers the customer to the cards shown below — for example: "Here are 8 tapes we
> carry — details are on the cards below." Do NOT list each product in the text, do NOT use
> markdown bold/asterisks (`**`) or numbered product lists. The cards already show the item
> number, size, and image; the text only frames them. You may mention a count or a highlight,
> but never re-enumerate the catalog rows.

### 2.2 UI safeguard (`frontend/index.html`)
The answer is injected via `innerHTML` with no markdown rendering (line ~207:
`$('#answer-text').innerHTML = linkifyCodes(data.answer);`), so any stray `**`/`*` leaks as
literal characters. Add a tiny sanitizer applied to `data.answer` BEFORE `linkifyCodes`:

```js
function stripMarkdown(s){
  return (s || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** -> bold
    .replace(/(^|\s)\*(\S.*?)\*/g, '$1$2')  // *italic* -> italic
    .replace(/^\s*[-*]\s+/gm, '')     // leading bullet markers
    .replace(/^\s*\d+\.\s+/gm, '');   // leading "1. " numbering
}
```
Then render with `$('#answer-text').innerHTML = linkifyCodes(stripMarkdown(data.answer));`.
This guarantees clean text even if the model occasionally ignores the prompt rule. The
existing `linkifyCodes` behavior is preserved (sanitizer runs first, returns a plain string).

## 3. Part B — Email lead-capture

### 3.1 New `email_owner` signature (`tools.py`)
```python
@tool
def email_owner(item_nos: list[str], customer_name: str,
                customer_phone: str = "", customer_email: str = "",
                customer_message: str = "") -> str:
    """Email the customer's selected products + contact details to the WISEUP owner as a
    lead. Requires the customer's name and at least one of phone or email. Call ONLY after
    the customer has given their contact details AND explicitly confirmed (said yes)."""
```

**Validation (before sending):**
```python
if not customer_name.strip() or not (customer_phone.strip() or customer_email.strip()):
    return ("Missing contact info: I need the customer's name and at least a phone number "
            "or an email address before sending.")
products = _lookup_products(item_nos)
if not products:
    return "No matching products found for those item numbers; nothing sent."
```
When validation returns a message (not a send), `ToolNode(handle_tool_errors=True)` surfaces
it back to the agent, which then asks the customer for the missing piece.

**Bulk or single:** `item_nos` is a list of 1+ item numbers → one combined email either way.

### 3.2 Lead email body (`_format_email`)
Replace the current body with a lead format:
```
New customer lead
Name:  <customer_name>
Phone: <customer_phone or "—">
Email: <customer_email or "—">

Interested in (<N> product(s)):
- <product_name> | item_no: <item_no> | size: <size> | material: <material> | packing: <packing>
...

Message: <customer_message or "(none)">
```
Subject: `New customer lead - <N> product(s) from <customer_name>`. Sent From/To
`OWNER_EMAIL` via the existing Gmail SMTP path. Product details come from `products.json`
(`_lookup_products`), not LLM memory.

### 3.3 Conversation flow (`SYSTEM_PROMPT`)
Replace the current confirm rule with:

> When the customer signals they are finished or ready to proceed/order, FIRST ask in a
> single message for their **name, phone number, and email** ("Could I get your name, phone
> number, and email so I can pass this to our team?"). You need their name and at least one
> of phone or email. Once you have valid contact details, ask them to confirm: "Shall I send
> these N products to the owner?" Only call `email_owner` AFTER they reply yes, passing the
> item numbers discussed plus the collected name, phone, and email. Never invent contact
> details or item numbers.

So the order is: **ready → ask contact (one message) → customer gives contact → ask "yes?" →
on yes → `email_owner`**.

## 4. Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `email_owner` (`tools.py`) | Validate contact, look up products, send lead email | `_lookup_products`, `_format_email`, smtplib, env `GMAIL_APP_PASSWORD` |
| `_format_email` (`tools.py`) | Render the lead body from products + contact | products list, contact fields |
| `SYSTEM_PROMPT` (`agent_graph.py`) | Card-aligned replies + contact-collection + explicit-yes flow | — |
| `stripMarkdown` (`frontend/index.html`) | Sanitize answer text before render | — |

## 5. Error handling

- Missing/invalid contact → tool returns a guidance string (not an exception); agent re-asks.
- Unknown item numbers → discarded by `_lookup_products`; if none remain, "nothing sent".
- SMTP failure → caught by `ToolNode(handle_tool_errors=True)`, surfaced to the agent as an
  error ToolMessage (no crash of `/ask`).

## 6. Testing

`tests/test_email_tool.py` updated:
1. **Happy path:** `email_owner` with name + phone + email + items → mocked `smtplib.SMTP_SSL`
   send; assert login creds from env, To = OWNER_EMAIL, body contains name, phone, email,
   item_no, product name, and customer message; returns "Sent N…".
2. **Missing contact:** name present but no phone AND no email → returns the "Missing contact
   info…" string and does NOT call SMTP (assert the fake SMTP was never constructed/used).
3. **Single item (bulk-or-single):** `item_nos=["010801"]` → one email, body lists exactly
   one product.
4. **Unknown items:** item numbers not in catalog → "nothing sent", no SMTP call.

Part A is prompt-only on the agent side (covered by the existing graph test that the agent
node still returns a final answer); the `stripMarkdown` JS is verified manually in the browser
(no JS test harness in this project).

Full suite must stay green (`python -m pytest -q`).

## 7. Out of scope (YAGNI)

- HTML/styled email (plain-text lead is enough for the owner).
- Persisting leads to a DB/CRM.
- Authentication on `/ask` (tracked separately).
- A JS test harness for the frontend.

## 8. Acceptance criteria

1. Catalog query → answer panel shows a short intro (no `**`, no per-item list); cards below
   show the products. Stray markdown from the model is stripped by the UI.
2. Customer says they're ready → agent asks for name/phone/email in one message.
3. Customer gives name + (phone or email) → agent asks "Shall I send these N to the owner?"
4. Customer says yes → owner receives a lead email containing the contact details + product
   details (bulk list or single item).
5. If the customer omits both phone and email, the agent asks again before sending.
6. Full test suite green; no secrets committed.
