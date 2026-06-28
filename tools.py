"""Agent tools + shared helpers for the WISEUP agentic RAG."""
import json
import rag
from typing import Annotated, Optional
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
from langchain_tavily import TavilySearch

_PRODUCTS = json.load(open("products.json", encoding="utf-8"))
_BY_ITEM = {str(p["item_no"]): p for p in _PRODUCTS if p.get("item_no")}


def to_card(doc, score):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "item_no": m.get("item_no", ""),
        "product_name": m.get("product_name") or "Product",
        "product_name_ar": m.get("product_name_ar", ""),
        "series": m.get("series", ""),
        "series_ar": m.get("series_ar", ""),
        "material": m.get("material", ""),
        "material_ar": m.get("material_ar", ""),
        "size": m.get("size", ""),
        "packing": m.get("packing", ""),
        "gross_weight": m.get("gross_weight", ""),
        "cbm": m.get("cbm", ""),
        "pdf_page": m.get("pdf_page", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        "relevance": max(5, min(100, round((1 - score / 2) * 100))),
    }


def _lookup_products(item_nos):
    return [_BY_ITEM[str(i)] for i in item_nos if str(i) in _BY_ITEM]


@tool
def retrieve_products(query: str, series: Optional[str],
                      tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Search the WISEUP product catalog for tools matching the query.
    Use for any question about specific products, sizes, materials, or item numbers.
    Optionally filter by a product series name."""
    results = rag.gate(rag.retrieve(query, k=8, series=[series] if series else None))
    cards = [to_card(d, s) for d, s in results]
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
    tav = TavilySearch(max_results=5, include_domains=["wiseuptools.com"])
    return _format_tavily(tav.invoke({"query": query}))
