# Agentic RAG on LangGraph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the WISEUP linear RAG into an agentic RAG: a two-node LangGraph agent that decides per turn whether to search the catalog, search the WISEUP website, or email the owner the customer's selected products.

**Architecture:** A ReAct-style tool-calling loop with two nodes — `agent` (`ChatOpenAI` bound to 3 tools) and `tools` (`ToolNode`) — wired by the prebuilt `tools_condition` router and compiled with a `MemorySaver` checkpointer for per-session memory. Retrieval is a tool wrapping the existing `rag.retrieve()`; generation is the agent node.

**Tech Stack:** Python 3.14, LangGraph, langchain-core, langchain-openai (`gpt-4o-mini`), langchain-tavily, Chroma, FastAPI, pytest. Windows / PowerShell.

## Global Constraints

- Python 3.14 on Windows; run commands in PowerShell.
- Generation model: `gpt-4o-mini` via `langchain_openai.ChatOpenAI`.
- Embeddings backend: `WISEUP_EMBED_BACKEND=openai` (`text-embedding-3-small`); Chroma index already built at `./chroma_db_openai`.
- Secrets ONLY via environment / `.env` (gitignored): `OPENAI_API_KEY`, `TAVILY_API_KEY`, `GMAIL_APP_PASSWORD`. NEVER write real secret values into any committed file (including this plan or tests).
- Owner email constant: `omaraqel270@gmail.com`. Web search locked to domain `wiseuptools.com`.
- Reuse existing `rag.retrieve()`, `rag.gate()`, `rag.build_context()`. Do not re-chunk or re-embed documents at query time.
- Email tool (`email_owner`) may only be called AFTER the customer confirms "yes".

---

## File Structure

| File | Responsibility |
|---|---|
| `tools.py` (new) | The 3 `@tool`s + shared helpers: `to_card`, `_lookup_products`, `_format_email`, `_format_tavily`, `TOOLS` list |
| `agent_graph.py` (new) | `AgentState`, `SYSTEM_PROMPT`, `agent_node`, graph assembly, compiled `graph` |
| `api.py` (modify) | `/ask` invokes the graph; `/reset` starts a new thread; import `to_card` from `tools`; drop `memory.py` |
| `rag.py` (unchanged) | Provides `retrieve()`, `gate()`, `build_context()` |
| `build_index.py` (unchanged) | Index-time only |
| `memory.py` | Retired (checkpointer replaces it) |
| `.env` (new, gitignored) | Secrets + `WISEUP_EMBED_BACKEND=openai` |
| `tests/` (new) | pytest unit tests, one module per component |

---

## Task 1: Project setup — git, ignore rules, dependencies, env loading

**Files:**
- Create: `.gitignore`, `.env`, `requirements.txt`, `tests/__init__.py`, `tests/test_setup.py`
- Modify: none

**Interfaces:**
- Consumes: nothing
- Produces: an installed env with `langgraph`, `langchain-tavily`, `python-dotenv`, `pytest`; secrets loaded from `.env`

- [ ] **Step 1: Initialize git (project is not yet a repo)**

```powershell
git init
git add -A
git commit -m "chore: snapshot existing WISEUP RAG before agentic refactor"
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
.env
__pycache__/
*.pyc
.venv/
venv/
chroma_db/
chroma_db_openai/
logs/
memory_store/
.pytest_cache/
```

- [ ] **Step 3: Write `.env` (paste the real secret values you already have — do NOT commit this file)**

```dotenv
OPENAI_API_KEY=<paste your OpenAI key>
TAVILY_API_KEY=<paste your Tavily key>
GMAIL_APP_PASSWORD=<paste the Gmail app password>
WISEUP_EMBED_BACKEND=openai
```

- [ ] **Step 4: Append new deps to `requirements.txt`** (create if missing)

```text
langgraph
langchain-core
langchain-openai
langchain-tavily
langchain-chroma
python-dotenv
pytest
```

- [ ] **Step 5: Install**

Run: `python -m pip install -U langgraph langchain-tavily python-dotenv pytest`
Expected: installs complete without error.

- [ ] **Step 6: Write the setup test** (`tests/test_setup.py`)

```python
import importlib


def test_core_imports_available():
    for mod in ["langgraph.graph", "langgraph.prebuilt", "langchain_tavily",
                "langchain_openai", "dotenv"]:
        assert importlib.import_module(mod) is not None
```

- [ ] **Step 7: Run the test**

Run: `python -m pytest tests/test_setup.py -v`
Expected: PASS (1 passed).

- [ ] **Step 8: Commit**

```powershell
git add .gitignore requirements.txt tests/__init__.py tests/test_setup.py
git commit -m "chore: add agentic-rag dependencies and env scaffolding"
```

---

## Task 2: Shared helpers in `tools.py` (`to_card`, `_lookup_products`)

**Files:**
- Create: `tools.py`, `tests/test_tool_helpers.py`
- Modify: `api.py` (import `to_card` from `tools`, remove its local copy)

**Interfaces:**
- Consumes: `rag` (existing), `products.json`
- Produces:
  - `to_card(doc, score) -> dict` — card with keys `item_no, product_name, product_name_ar, series, series_ar, material, material_ar, size, packing, gross_weight, cbm, pdf_page, image_url, relevance`
  - `_lookup_products(item_nos: list[str]) -> list[dict]` — full product rows from `products.json` by item number

- [ ] **Step 1: Write the failing test** (`tests/test_tool_helpers.py`)

```python
from langchain_core.documents import Document
import tools


def test_to_card_maps_metadata_and_image():
    doc = Document(page_content="x", metadata={
        "item_no": "010801", "product_name": "Circlip Pliers",
        "series": "Pliers Series", "size": "7\"/175MM",
        "image": "images\\p1.png"})
    card = tools.to_card(doc, 0.4)
    assert card["item_no"] == "010801"
    assert card["product_name"] == "Circlip Pliers"
    assert card["image_url"] == "/images/p1.png"
    assert 5 <= card["relevance"] <= 100


def test_lookup_products_returns_known_item():
    # pick the first real item number from the catalog
    import json
    rows = json.load(open("products.json", encoding="utf-8"))
    item = next(str(r["item_no"]) for r in rows if r.get("item_no"))
    found = tools._lookup_products([item])
    assert found and str(found[0]["item_no"]) == item
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_tool_helpers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tools'`.

- [ ] **Step 3: Create `tools.py` with the helpers**

```python
"""Agent tools + shared helpers for the WISEUP agentic RAG."""
import json
import rag

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_tool_helpers.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Point `api.py` at the shared `to_card`**

In `api.py`, delete the local `def to_card(...)` (lines ~51-70) and add near the top imports:

```python
from tools import to_card
```

- [ ] **Step 6: Sanity-check the import doesn't break api**

Run: `python -c "import api"`
Expected: no error (ignore the harmless pydantic v1 deprecation warning).

- [ ] **Step 7: Commit**

```powershell
git add tools.py tests/test_tool_helpers.py api.py
git commit -m "feat: add tools.py with shared to_card and product lookup helpers"
```

---

## Task 3: `retrieve_products` tool

**Files:**
- Modify: `tools.py`
- Create: `tests/test_retrieve_tool.py`

**Interfaces:**
- Consumes: `rag.retrieve`, `rag.gate`, `rag.build_context`, `to_card`
- Produces: `retrieve_products` (`StructuredTool`) — args `(query: str, series: Optional[str], tool_call_id)`; returns a `Command` updating `retrieved_products` (list[dict]) and appending a `ToolMessage`

- [ ] **Step 1: Write the failing test** (`tests/test_retrieve_tool.py`)

```python
from langchain_core.documents import Document
from langgraph.types import Command
import tools


def test_retrieve_products_returns_command_with_cards(monkeypatch):
    doc = Document(page_content="Circlip Pliers", metadata={
        "item_no": "010801", "product_name": "Circlip Pliers",
        "series": "Pliers Series", "size": "7\"/175MM", "image": "images\\a.png"})
    monkeypatch.setattr(tools.rag, "retrieve", lambda q, k=8, series=None: [(doc, 0.4)])
    monkeypatch.setattr(tools.rag, "gate", lambda results: results)

    cmd = tools.retrieve_products.func(
        query="circlip pliers", series=None, tool_call_id="tc1")

    assert isinstance(cmd, Command)
    assert cmd.update["retrieved_products"][0]["item_no"] == "010801"
    msg = cmd.update["messages"][0]
    assert msg.tool_call_id == "tc1"
    assert "Circlip Pliers" in msg.content
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_retrieve_tool.py -v`
Expected: FAIL with `AttributeError: module 'tools' has no attribute 'retrieve_products'`.

- [ ] **Step 3: Add the tool to `tools.py`**

Add imports at the top of `tools.py`:

```python
from typing import Annotated, Optional
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
```

Then append:

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_retrieve_tool.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```powershell
git add tools.py tests/test_retrieve_tool.py
git commit -m "feat: add retrieve_products tool (Command updates retrieved_products + ToolMessage)"
```

---

## Task 4: `search_wiseup_web` tool (Tavily, domain-locked)

**Files:**
- Modify: `tools.py`
- Create: `tests/test_web_tool.py`

**Interfaces:**
- Consumes: `langchain_tavily.TavilySearch`
- Produces:
  - `_format_tavily(res: dict) -> str`
  - `search_wiseup_web` (`StructuredTool`) — arg `(query: str)`; returns `str`

- [ ] **Step 1: Write the failing test** (`tests/test_web_tool.py`)

```python
import tools


def test_search_wiseup_web_formats_results(monkeypatch):
    class FakeTavily:
        def __init__(self, **kw):
            assert kw["include_domains"] == ["wiseuptools.com"]
        def invoke(self, payload):
            return {"results": [
                {"title": "About WISEUP", "url": "https://www.wiseuptools.com/about",
                 "content": "WISEUP makes hand tools."}]}

    monkeypatch.setattr(tools, "TavilySearch", FakeTavily)
    out = tools.search_wiseup_web.func(query="about wiseup")
    assert "About WISEUP" in out
    assert "wiseuptools.com/about" in out
    assert "hand tools" in out
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_web_tool.py -v`
Expected: FAIL (`AttributeError: ... 'search_wiseup_web'`).

- [ ] **Step 3: Add the tool to `tools.py`**

Add import at the top:

```python
from langchain_tavily import TavilySearch
```

Append:

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_web_tool.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```powershell
git add tools.py tests/test_web_tool.py
git commit -m "feat: add search_wiseup_web tool (Tavily locked to wiseuptools.com)"
```

---

## Task 5: `email_owner` tool (Gmail SMTP)

**Files:**
- Modify: `tools.py`
- Create: `tests/test_email_tool.py`

**Interfaces:**
- Consumes: `_lookup_products`, `smtplib`, env `GMAIL_APP_PASSWORD`
- Produces:
  - `_format_email(products: list[dict], customer_message: str) -> str`
  - `email_owner` (`StructuredTool`) — args `(item_nos: list[str], customer_message: str)`; returns `str`
  - constant `OWNER_EMAIL = "omaraqel270@gmail.com"`

- [ ] **Step 1: Write the failing test** (`tests/test_email_tool.py`)

```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_email_tool.py -v`
Expected: FAIL (`AttributeError: ... 'email_owner'`).

- [ ] **Step 3: Add the tool to `tools.py`**

Add imports at the top:

```python
import os
import ssl
import smtplib
from email.message import EmailMessage
```

Append:

```python
OWNER_EMAIL = "omaraqel270@gmail.com"


def _format_email(products, customer_message) -> str:
    lines = ["A customer is interested in the following WISEUP products:", ""]
    for p in products:
        lines.append(
            f"- {p.get('product_name','Product')} | item_no: {p.get('item_no','')} | "
            f"size: {p.get('size','')} | material: {p.get('material','')} | "
            f"packing: {p.get('packing','')}")
    lines += ["", f"Customer message: {customer_message}"]
    return "\n".join(lines)


@tool
def email_owner(item_nos: list[str], customer_message: str) -> str:
    """Email the selected products' full details to the WISEUP owner.
    ONLY call this AFTER the customer has explicitly confirmed (said yes)."""
    products = _lookup_products(item_nos)
    if not products:
        return "No matching products found for those item numbers; nothing sent."
    msg = EmailMessage()
    msg["Subject"] = f"New customer interest - {len(products)} product(s)"
    msg["From"] = OWNER_EMAIL
    msg["To"] = OWNER_EMAIL
    msg.set_content(_format_email(products, customer_message))
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(OWNER_EMAIL, os.environ["GMAIL_APP_PASSWORD"])
        s.send_message(msg)
    return f"Sent {len(products)} product(s) to the owner."
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_email_tool.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Add the `TOOLS` list at the end of `tools.py`**

```python
TOOLS = [retrieve_products, search_wiseup_web, email_owner]
```

- [ ] **Step 6: Commit**

```powershell
git add tools.py tests/test_email_tool.py
git commit -m "feat: add email_owner tool (Gmail SMTP) and TOOLS list"
```

---

## Task 6: `agent_graph.py` — state, agent node, graph assembly

**Files:**
- Create: `agent_graph.py`, `tests/test_agent_graph.py`

**Interfaces:**
- Consumes: `tools.TOOLS`, `langchain_openai.ChatOpenAI`, LangGraph
- Produces:
  - `AgentState` TypedDict (`messages`, `session_id`, `retrieved_products`)
  - `agent_node(state) -> dict`
  - compiled `graph` (with `MemorySaver` checkpointer)

- [ ] **Step 1: Write the failing test** (`tests/test_agent_graph.py`)

```python
from langchain_core.messages import HumanMessage, AIMessage
import agent_graph


def test_graph_returns_final_answer_when_no_tool_calls(monkeypatch):
    class FakeLLM:
        def bind_tools(self, tools): return self
        def invoke(self, messages): return AIMessage(content="Hello from WISEUP!")

    monkeypatch.setattr(agent_graph, "ChatOpenAI", lambda **kw: FakeLLM())

    state = agent_graph.graph.invoke(
        {"messages": [HumanMessage("hi")], "session_id": "t1"},
        {"configurable": {"thread_id": "t1"}})

    assert state["messages"][-1].content == "Hello from WISEUP!"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_agent_graph.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'agent_graph'`).

- [ ] **Step 3: Create `agent_graph.py`**

```python
"""Agentic RAG graph for WISEUP: agent <-> tools loop on LangGraph."""
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from tools import TOOLS

SYSTEM_PROMPT = """You are the WISEUP tools catalog assistant, a friendly B2B assistant \
for a hand-tools and power-tools brand.

Tools you can use:
- retrieve_products: search the local product catalog. Use for any question about specific \
tools, sizes, materials, item numbers, or what is available.
- search_wiseup_web: search the official WISEUP website (wiseuptools.com). Use ONLY for \
company/website info that is NOT in the catalog (about the company, contact, certifications).
- email_owner: send the customer's selected products to the business owner.

Rules:
- Always cite item numbers and sizes from retrieved products. Never invent item numbers or products.
- When the customer signals they are finished or ready to proceed/order (any phrasing, e.g. \
"that's all", "I'll take these", "send it over", "we're good"), FIRST ask them to confirm: \
"Shall I send these N products to the owner?". Only call email_owner AFTER they reply yes, \
passing the item numbers discussed.
- Keep replies concise and friendly."""


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    session_id: str
    retrieved_products: list[dict]


def agent_node(state: AgentState) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3).bind_tools(TOOLS)
    ai = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    return {"messages": [ai]}


def _build_graph():
    builder = StateGraph(AgentState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(TOOLS, handle_tool_errors=True))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", tools_condition)
    builder.add_edge("tools", "agent")
    return builder.compile(checkpointer=MemorySaver())


graph = _build_graph()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_agent_graph.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```powershell
git add agent_graph.py tests/test_agent_graph.py
git commit -m "feat: add LangGraph agent graph (agent<->tools loop + checkpointer)"
```

---

## Task 7: Wire the graph into `api.py`

**Files:**
- Modify: `api.py`
- Create: `tests/test_api.py`

**Interfaces:**
- Consumes: `agent_graph.graph`, `to_card` (already imported in Task 2)
- Produces: `/ask` returning `{answer, products}`; `/reset` returning `{ok: true}`. No `memory` import.

- [ ] **Step 1: Write the failing test** (`tests/test_api.py`)

```python
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
import api


def test_ask_returns_answer_and_products(monkeypatch):
    def fake_invoke(payload, config):
        return {"messages": [AIMessage(content="Here are circlip pliers.")],
                "retrieved_products": [{"item_no": "010801", "product_name": "Circlip Pliers"}]}

    monkeypatch.setattr(api.graph, "invoke", fake_invoke)
    client = TestClient(api.app)
    r = client.post("/ask", json={"query": "circlip pliers", "session_id": "s1"})
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "Here are circlip pliers."
    assert body["products"][0]["item_no"] == "010801"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_api.py -v`
Expected: FAIL (`AttributeError: module 'api' has no attribute 'graph'`).

- [ ] **Step 3: Edit `api.py` imports**

Remove `import memory` and the `import rag` line if unused, and add:

```python
from langchain_core.messages import HumanMessage
from agent_graph import graph
from tools import to_card  # (added in Task 2)
```

- [ ] **Step 4: Replace the `/ask` handler body**

```python
@app.post("/ask")
def ask(req: AskReq):
    t0 = time.time()
    thread = req.session_id or "default"
    config = {"configurable": {"thread_id": thread}}
    state = graph.invoke(
        {"messages": [HumanMessage(req.query)], "session_id": thread}, config)
    answer = state["messages"][-1].content
    products = state.get("retrieved_products", [])
    top_score = products[0].get("relevance") if products else None
    log_interaction(req, answer, len(products), top_score, int((time.time() - t0) * 1000))
    return {"answer": answer, "products": products}
```

- [ ] **Step 5: Replace the `/reset` handler to use a fresh thread**

```python
@app.post("/reset")
def reset(req: ResetReq):
    # With the checkpointer, "resetting" means the client starts a new thread id.
    return {"ok": True, "session_id": req.session_id}
```

- [ ] **Step 6: Run the api test**

Run: `python -m pytest tests/test_api.py -v`
Expected: PASS (1 passed).

- [ ] **Step 7: Run the whole suite**

Run: `python -m pytest -v`
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```powershell
git add api.py tests/test_api.py
git commit -m "feat: wire LangGraph agent into /ask and /reset; retire memory.py"
```

---

## Task 8: End-to-end smoke test + run config

**Files:**
- Modify: `start.bat`
- Create: `tests/test_smoke_live.py` (marked, opt-in — hits real services)

**Interfaces:**
- Consumes: the compiled `graph`, real env keys
- Produces: a verified running server

- [ ] **Step 1: Update `start.bat` to load `.env` and the openai backend**

```bat
@echo off
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set %%a=%%b
set WISEUP_EMBED_BACKEND=openai
echo Starting WISEUP agentic assistant on http://127.0.0.1:8000
python -m uvicorn api:app --host 127.0.0.1 --port 8000
pause
```

- [ ] **Step 2: Write an opt-in live smoke test** (`tests/test_smoke_live.py`)

```python
import os
import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("RUN_LIVE"), reason="set RUN_LIVE=1 to hit real services")


def test_catalog_question_returns_products():
    from langchain_core.messages import HumanMessage
    from agent_graph import graph
    state = graph.invoke(
        {"messages": [HumanMessage("what circlip pliers do you have?")], "session_id": "live1"},
        {"configurable": {"thread_id": "live1"}})
    assert state["messages"][-1].content
    assert state.get("retrieved_products")
```

- [ ] **Step 3: Run the live smoke test with real keys**

Run (PowerShell):
```powershell
$env:RUN_LIVE=1; foreach ($l in Get-Content .env) { if ($l -match '^(.*?)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }; python -m pytest tests/test_smoke_live.py -v
```
Expected: PASS — final message non-empty and products returned.

- [ ] **Step 4: Launch the server and manually verify the 3 acceptance flows**

Run: `./start.bat` then open http://127.0.0.1:8000 and check:
1. English catalog question → answer + product cards with images.
2. "Tell me about the WISEUP company" → web-search answer (domain-locked).
3. Say "that's all, I'll take the circlip pliers" → agent asks to confirm → reply "yes" → owner receives an email at `omaraqel270@gmail.com`.

Expected: all three behave as described.

- [ ] **Step 5: Commit**

```powershell
git add start.bat tests/test_smoke_live.py
git commit -m "chore: env-loading start.bat + opt-in live smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** graph (Task 6) ✓; 3 tools (Tasks 3-5) ✓; state with `add_messages` (Task 6) ✓; retrieval-as-tool / index-vs-query split honored by reusing `rag.retrieve` (Task 3) ✓; checkpointer memory replacing `memory.py` (Tasks 6-7) ✓; Tavily domain lock (Task 4) ✓; agent-driven email with yes-confirmation in system prompt (Task 6) ✓; `/ask` + `/reset` integration (Task 7) ✓; secrets gitignored (Task 1) ✓; acceptance criteria (Task 8) ✓.
- **Type consistency:** `to_card(doc, score)`, `_lookup_products(item_nos)`, `retrieve_products(query, series, tool_call_id)`, `search_wiseup_web(query)`, `email_owner(item_nos, customer_message)`, `AgentState{messages, session_id, retrieved_products}`, `TOOLS` used consistently across tasks.
- **No placeholders:** every code/test step is complete; the only `<paste ...>` markers are in `.env` (Task 1) by design — real secrets must never be committed.
