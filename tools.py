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
from langchain_core.messages import ToolMessage, SystemMessage, HumanMessage
from langgraph.types import Command
from langchain_tavily import TavilyCrawl
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


def _rank_relevance(i: int, n: int) -> int:
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
    if isinstance(res, str):
        return res.strip() or "No results found on the WISEUP website."
    items = res.get("results", []) if isinstance(res, dict) else (res or [])
    if not items:
        return "No results found on the WISEUP website."
    lines = []
    for r in items:
        lines.append(f"- {r.get('title','')} ({r.get('url','')})\n  {r.get('content','')}")
    return "\n".join(lines)


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


SITE_URL = os.environ.get("WISEUP_SITE_URL", "https://www.wiseuptools.com/h-col-103.html")

_WEB_EXTRACT_SYS = (
    "You extract products from crawled web page content of a hand-tools store. "
    "Return ONLY a JSON array (no prose, no markdown) of objects with keys: "
    "name (string), price (number or null), image_url (absolute URL string or empty), "
    "source_url (absolute product URL string or empty). If there are no products, return []."
)


def _web_llm():
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", temperature=0)


def _collect_images(res) -> list:
    imgs = []
    if isinstance(res, dict):
        imgs += [u for u in res.get("images", []) or [] if isinstance(u, str)]
        for r in res.get("results", []) or []:
            if isinstance(r, dict):
                imgs += [u for u in r.get("images", []) or [] if isinstance(u, str)]
    return imgs


def _strip_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[-1] if "\n" in s else s[3:]
        s = s.rsplit("```", 1)[0]
    return s.strip()


def _extract_web_products(res, query: str) -> list:
    if not res or not isinstance(res, dict):
        return []
    images = _collect_images(res)
    raw = "\n\n".join(
        r.get("raw_content", "") for r in (res.get("results", []) or []) if isinstance(r, dict))
    text = raw or _format_tavily(res)   # prefer real page text; fall back to the summary
    human = (f"Query: {query}\n\nPage content:\n{text}\n\n"
             f"Image URLs found:\n" + "\n".join(images))
    try:
        raw = _web_llm().invoke(
            [SystemMessage(content=_WEB_EXTRACT_SYS), HumanMessage(content=human)]).content
        data = json.loads(_strip_fences(raw))
        return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else []
    except Exception:
        return []


def to_web_card(rec: dict, relevance: int) -> dict:
    price = rec.get("price")
    price = price if isinstance(price, (int, float)) and not isinstance(price, bool) else None
    return {
        "code": "",
        "name_ar": rec.get("name", "") or "",
        "price_jod": price,
        "unit": "",
        "image_url": rec.get("image_url", "") or "",
        "source_url": rec.get("source_url", "") or "",
        "relevance": int(relevance),
    }


_crawler = None


def _get_crawler():
    global _crawler
    if _crawler is None:
        _crawler = TavilyCrawl(format="markdown")
    return _crawler


@tool
def browse_wiseup_website(query: str,
                          tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Crawl the live WISEUP website (wiseuptools.com) for products or company info that is NOT
    in the local catalog, or when the customer explicitly asks about the website. Prefer
    retrieve_products first; only use this when the catalog has nothing relevant."""
    log(f"🔧 TOOL browse_wiseup_website(query={query!r}) [crawl {SITE_URL}]")
    try:
        res = _get_crawler().invoke({
            "url": SITE_URL, "instructions": query, "include_images": True,
            "extract_depth": "advanced", "max_depth": 2, "limit": 15,
        })
        recs = _extract_web_products(res, query)
    except Exception as e:
        log(f"🔧 TOOL browse_wiseup_website → error: {e}")
        recs = []
    if not recs:
        log("🔧 TOOL browse_wiseup_website → no products found")
        return Command(update={"messages": [ToolMessage(
            "I couldn't find that on the WISEUP website.", tool_call_id=tool_call_id)]})
    cards = [to_web_card(r, _rank_relevance(i, len(recs))) for i, r in enumerate(recs)]
    log(f"🔧 TOOL browse_wiseup_website → {len(cards)} product(s) from the website")
    return Command(update={
        "retrieved_products": cards,
        "messages": [ToolMessage(
            f"Found {len(cards)} product(s) on the WISEUP website.", tool_call_id=tool_call_id)],
    })


TOOLS = [retrieve_products, browse_wiseup_website, email_owner]
