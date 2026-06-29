"""Agent tools + shared helpers for the WISEUP agentic RAG."""
import json
import os
import ssl
import smtplib
import rag
from typing import Annotated, Optional
from email.message import EmailMessage
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from langchain_tavily import TavilySearch
from runlog import log

_PRODUCTS = json.load(open("products.json", encoding="utf-8"))
_BY_ITEM = {str(p["code"]): p for p in _PRODUCTS if p.get("code")}


def to_card(doc, score):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "code": m.get("code", ""),
        "name_ar": m.get("name_ar", ""),
        "price_jod": m.get("price_jod", 0),
        "unit": m.get("unit", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        "relevance": max(5, min(100, round((1 - score / 2) * 100))),
    }


def _lookup_products(item_nos):
    return [_BY_ITEM[str(i)] for i in item_nos if str(i) in _BY_ITEM]


@tool
def retrieve_products(query: str,
                      tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Search the WISEUP Arabic product catalog (with JOD prices) for tools matching the
    query. Use for any question about specific products, prices, or codes."""
    log(f"🔧 TOOL retrieve_products(query={query!r})")
    results = rag.gate(rag.retrieve(query, k=8))
    cards = [to_card(d, s) for d, s in results]
    log(f"🔧 TOOL retrieve_products → found {len(cards)} product(s)")
    summary = rag.build_context(results) or "No matching products found."
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


TOOLS = [retrieve_products, search_wiseup_web, email_owner]
