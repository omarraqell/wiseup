"""Agent tools + shared helpers for the WISEUP agentic RAG."""
import json
import os
import re
import ssl
import smtplib
import rag
from typing import Annotated
from email.message import EmailMessage
from pydantic import Field
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from langchain_tavily import TavilySearch
from runlog import log

_PRODUCTS = json.load(open("products.json", encoding="utf-8"))
_BY_ITEM = {str(p["code"]): p for p in _PRODUCTS if p.get("code")}


def to_card(doc, relevance):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "code": m.get("code", ""),
        "name_ar": m.get("name_ar", ""),
        "price_jod": m.get("price_jod", 0),
        "unit": m.get("unit", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        "relevance": int(relevance),
    }


def _rank_relevance(i, n):
    """Map rank position 0..n-1 to a 95..55 badge (UI nicety; order is what matters)."""
    if n <= 1:
        return 95
    return round(95 - (i / (n - 1)) * 40)


def _lookup_products(item_nos):
    return [_BY_ITEM[str(i)] for i in item_nos if str(i) in _BY_ITEM]


@tool
def retrieve_products(query: str,
                      tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Search the WISEUP Arabic product catalog (with JOD prices) for tools matching the
    query. Use for any question about specific products, prices, or codes."""
    log(f"🔧 TOOL retrieve_products(query={query!r})")
    docs = rag.hybrid_retrieve(query, k=8)
    cards = [to_card(d, _rank_relevance(i, len(docs))) for i, d in enumerate(docs)]
    log(f"🔧 TOOL retrieve_products → found {len(cards)} product(s)")
    summary = rag.build_context(docs) or "No matching products found."
    return Command(update={
        "retrieved_products": cards,
        "messages": [ToolMessage(summary, tool_call_id=tool_call_id)],
    })


def _format_tavily(res) -> str:
    items = res.get("results", []) if isinstance(res, dict) else res
    if not items:
        return "No results found on the WISEUP website."
    lines = []
    for r in items:
        lines.append(f"- {r.get('title','')} ({r.get('url','')})\n  {r.get('content','')}")
    return "\n".join(lines)


@tool
def search_wiseup_web(query: str) -> str:
    """Search the official WISEUP website (wiseuptools.com) for company or
    product-page information that is NOT in the local catalog — e.g. about the
    company, contact details, certifications, or specific web pages."""
    log(f"🔧 TOOL search_wiseup_web(query={query!r}) [domain-locked: wiseuptools.com]")
    tav = TavilySearch(max_results=5, include_domains=["wiseuptools.com"])
    out = _format_tavily(tav.invoke({"query": query}))
    log("🔧 TOOL search_wiseup_web → got results" if "No results" not in out
        else "🔧 TOOL search_wiseup_web → no results")
    return out


OWNER_EMAIL = "omaraqel270@gmail.com"

# Contact-field formats (kept in sync with the Field(pattern=...) on email_owner).
# Jordanian mobile: local 0 + 77/78/79 + 7 digits. Email: must contain '@' and a dot.
_PHONE_RE = re.compile(r"^(077|078|079)\d{7}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_phone(p: str) -> bool:
    return bool(_PHONE_RE.match(p.strip()))


def _valid_email(e: str) -> bool:
    return bool(_EMAIL_RE.match(e.strip()))


def _format_email(products, customer_name, customer_phone, customer_email, customer_message) -> str:
    lines = [
        "New customer lead",
        f"Name:  {customer_name}",
        f"Phone: {customer_phone or '—'}",
        f"Email: {customer_email or '—'}",
        "",
        f"Interested in ({len(products)} product(s)):",
    ]
    total = 0.0
    for p in products:
        price = p.get("price_jod", 0) or 0
        total += float(price)
        lines.append(
            f"- {p.get('name_ar','')} | كود: {p.get('code','')} | "
            f"الوحدة: {p.get('unit','')} | السعر: {price} JOD")
    lines += ["", f"Total: {round(total, 2)} JOD", "", f"Message: {customer_message or '(none)'}"]
    return "\n".join(lines)


@tool
def email_owner(
    item_nos: list[str],
    customer_name: str,
    customer_phone: Annotated[str, Field(
        description="Jordan mobile, starts 077/078/079",
        pattern=r"^$|^(077|078|079)\d{7}$")] = "",
    customer_email: Annotated[str, Field(
        description="Customer email, must contain @ and a dot",
        pattern=r"^$|^[^@\s]+@[^@\s]+\.[^@\s]+$")] = "",
    customer_message: str = "",
) -> str:
    """Email the customer's selected products and contact details to the WISEUP owner as a
    lead. Requires the customer's name and at least one of phone or email. Phone must be a
    Jordanian mobile starting 077/078/079; email must contain @ and a dot. Call ONLY after
    the customer has given their contact details AND explicitly confirmed (said yes)."""
    log(f"🔧 TOOL email_owner(item_nos={item_nos}, name={customer_name!r})")
    if not customer_name.strip() or not (customer_phone.strip() or customer_email.strip()):
        log("🔧 TOOL email_owner → missing contact info; nothing sent")
        return ("Missing contact info: I need the customer's name and at least a phone "
                "number or an email address before sending.")
    if customer_phone.strip() and not _valid_phone(customer_phone):
        log("🔧 TOOL email_owner → invalid phone; nothing sent")
        return ("Invalid phone number: a Jordanian mobile must start with 077, 078, or 079 "
                "and be 10 digits (e.g. 0791234567). Please ask the customer to re-check.")
    if customer_email.strip() and not _valid_email(customer_email):
        log("🔧 TOOL email_owner → invalid email; nothing sent")
        return ("Invalid email address: it must contain '@' and a domain like "
                "name@example.com. Please ask the customer to re-check.")
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


TOOLS = [retrieve_products, search_wiseup_web, email_owner]
