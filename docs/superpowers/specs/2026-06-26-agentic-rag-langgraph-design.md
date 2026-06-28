# Agentic RAG on LangGraph — Design Spec

**Date:** 2026-06-26
**Project:** WISEUP Catalog Assistant
**Status:** Approved design → ready for implementation plan

## 1. Goal

Evolve the current linear RAG (retrieve → generate) into an **agentic RAG** built on
**LangGraph**, where an LLM agent decides — turn by turn — which tool to call:
search the product catalog, search the WISEUP website, or email the owner a customer's
selected products. The agent loops until it produces a final answer.

## 2. Architecture — the graph

Tool-calling agent loop (ReAct). **Two nodes**, looping until the agent emits a final
answer with no tool calls.

```
                          ┌──────────────────────────────────┐
                          │                                   │
   START ─────► [ agent ] ──(tools_condition)──► [ tools ] ───┘
                    │  ▲        has tool_calls?     ToolNode
                    │  │                            (executes tool(s),
                    │  └──────────────────────────── appends ToolMessages)
                    │
                    └──(no tool_calls = final answer)──► END
```

- **`agent` node** — `ChatOpenAI("gpt-4o-mini").bind_tools(TOOLS)`. Invoked with a
  `SystemMessage` (role + rules) prepended to the running `messages`. Returns an
  `AIMessage` that either carries `tool_calls` or is the final reply.
- **`tools` node** — `ToolNode(TOOLS, handle_tool_errors=True)`. Executes the requested
  tool(s) and appends `ToolMessage`s.
- **`tools_condition`** — LangGraph prebuilt router: tool calls → `tools`, else → `END`.
- **Checkpointer** — `MemorySaver` keyed by `thread_id = session_id` provides
  conversation memory (replaces the old `memory.py`).

**RAG mapping:** retrieval is a **tool** (`retrieve_products`); generation is the
**`agent` node**. The graph stays two nodes — intelligence lives in the tools + system prompt.

### Index vs query phases (clarification)

- **Index time (offline, `build_index.py`, run once):** Load products → (minimal) chunk →
  embed each doc → store vectors in Chroma. Chunking and **document** embedding happen here.
- **Query time (online, `retrieve_products` tool, every request):** embed the **query** →
  similarity search in Chroma → relevance gate → product cards.

Chunking and document-embedding are **not** in the retrieval node. The tool only embeds the
incoming query and reads Chroma.

## 3. State

```python
from typing import Annotated, TypedDict, Optional
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]  # Human/AI/Tool history
    session_id: str
    retrieved_products: list[dict]   # latest structured cards for the frontend (overwrite)
```

`add_messages` appends + de-dupes by id. `retrieved_products` overwrites with the most
recent retrieval (what the UI should show now).

## 4. Tools

All three are `@tool`-decorated functions in a new `tools.py`.

### 4.1 `retrieve_products(query, series=None) -> Command`
Wraps the existing `rag.retrieve()` + `rag.gate()`. Returns a `Command` that both writes the
structured cards into state and appends a text `ToolMessage` summary for the LLM.

```python
from typing import Annotated, Optional
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command
import rag

@tool
def retrieve_products(query: str, series: Optional[str],
                      tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Search the WISEUP product catalog for tools matching the query.
    Optionally filter by a product series name."""
    results = rag.gate(rag.retrieve(query, k=8, series=[series] if series else None))
    cards = [to_card(d, s) for d, s in results]          # to_card defined in tools.py (moved out of api.py to avoid a circular import)
    summary = rag.build_context(results) or "No matching products found."
    return Command(update={
        "retrieved_products": cards,
        "messages": [ToolMessage(summary, tool_call_id=tool_call_id)],
    })
```

### 4.2 `search_wiseup_web(query) -> str`
Tavily search restricted to the WISEUP domain.

```python
from langchain_tavily import TavilySearch

@tool
def search_wiseup_web(query: str) -> str:
    """Search the official WISEUP website (wiseuptools.com) for company or product-page
    info that is NOT in the local catalog (e.g. about the company, contact, availability)."""
    tav = TavilySearch(max_results=5, include_domains=["wiseuptools.com"])
    res = tav.invoke({"query": query})
    return _format_tavily(res)
```

### 4.3 `email_owner(item_nos, customer_message) -> str`
Looks up the **full, authoritative** details of each item number from `products.json`
(not LLM memory), builds an email, and sends it via Gmail SMTP to the owner.

```python
import smtplib, ssl, os, json
from email.message import EmailMessage

OWNER_EMAIL = "omaraqel270@gmail.com"

@tool
def email_owner(item_nos: list[str], customer_message: str) -> str:
    """Email the selected products' full details to the WISEUP owner.
    ONLY call this AFTER the customer has explicitly confirmed (said yes)."""
    products = _lookup_products(item_nos)        # from products.json by item_no
    body = _format_email(products, customer_message)
    msg = EmailMessage()
    msg["Subject"] = f"New customer interest — {len(products)} product(s)"
    msg["From"] = OWNER_EMAIL
    msg["To"] = OWNER_EMAIL
    msg.set_content(body)
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(OWNER_EMAIL, os.environ["GMAIL_APP_PASSWORD"])
        s.send_message(msg)
    return f"Sent {len(products)} product(s) to the owner."
```

**Confirmation flow (agent-driven):** the system prompt instructs the agent that when it
detects the customer is finished / ready to proceed (any phrasing — "that's all",
"I'll take these", "send it over"), it must FIRST ask in chat: *"Shall I send these N
products to the owner?"* and only call `email_owner` after the customer replies yes.

## 5. Agent node + system prompt

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

TOOLS = [retrieve_products, search_wiseup_web, email_owner]
SYSTEM = SystemMessage(content=SYSTEM_PROMPT)

def agent_node(state: AgentState) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3).bind_tools(TOOLS)
    ai = llm.invoke([SYSTEM] + state["messages"])
    return {"messages": [ai]}
```

`SYSTEM_PROMPT` rules: WISEUP B2B tools assistant; use `retrieve_products` for catalog
questions; use `search_wiseup_web` only for company/website info not in the catalog; when
the customer signals they are done, ask to confirm, then call `email_owner` with the
discussed item numbers; never invent item numbers; cite item numbers and sizes.

## 6. Graph assembly

```python
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver

builder = StateGraph(AgentState)
builder.add_node("agent", agent_node)
builder.add_node("tools", ToolNode(TOOLS, handle_tool_errors=True))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", tools_condition)
builder.add_edge("tools", "agent")
graph = builder.compile(checkpointer=MemorySaver())
```

## 7. FastAPI integration (`api.py`)

```python
from langchain_core.messages import HumanMessage
from agent_graph import graph

@app.post("/ask")
def ask(req: AskReq):
    thread = req.session_id or "default"
    config = {"configurable": {"thread_id": thread}}
    state = graph.invoke(
        {"messages": [HumanMessage(req.query)], "session_id": thread}, config)
    answer = state["messages"][-1].content
    products = state.get("retrieved_products", [])
    return {"answer": answer, "products": products}
```

`/reset` starts a fresh thread id for the session (checkpointer-based; no `memory.py`).

## 8. Files

| File | Change |
|---|---|
| `agent_graph.py` | **new** — `AgentState`, `agent_node`, graph assembly, compiled `graph` |
| `tools.py` | **new** — the 3 `@tool`s + helpers (`to_card`, `_lookup_products`, `_format_email`, `_format_tavily`) |
| `rag.py` | reuse `retrieve()`, `gate()`, `build_context()`; the LLM `chat()`/`answer*()` helpers become unused by the agent path (kept for now) |
| `api.py` | `/ask` invokes the graph; `/reset` switches thread; drop `memory.py` calls; move `to_card` out to `tools.py` (import it back from there) to avoid a circular import |
| `build_index.py` | unchanged (index-time) |
| `memory.py` | retired (checkpointer replaces it) |
| `.env` | `OPENAI_API_KEY`, `TAVILY_API_KEY`, `GMAIL_APP_PASSWORD`, `WISEUP_EMBED_BACKEND=openai` — **gitignored** |
| `requirements` | add `langgraph`, `langchain-tavily`, `tavily-python` |

## 9. Secrets / config

All secrets via env (`.env`, gitignored): `OPENAI_API_KEY`, `TAVILY_API_KEY`,
`GMAIL_APP_PASSWORD`, plus `WISEUP_EMBED_BACKEND=openai`. `OWNER_EMAIL` is a constant.
`start.bat` updated to load them.

## 10. Out of scope (YAGNI for now)

- Corrective-RAG grading/rewrite nodes (can graft on later if Arabic recall needs it).
- Human-in-the-loop `interrupt()` for email (using conversational yes/no instead).
- RAGAS evaluation (separate task).

## 11. Acceptance criteria

1. English catalog question → agent calls `retrieve_products`, returns answer + cards.
2. "Tell me about the WISEUP company" → agent calls `search_wiseup_web` (domain-locked).
3. Customer says they're done → agent asks to confirm → on "yes" → `email_owner` sends,
   owner receives an email with full product details.
4. Conversation memory persists across turns within a `session_id` via the checkpointer.
5. No secrets committed to git.
