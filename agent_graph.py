"""Agentic RAG graph for WISEUP: agent <-> tools loop on LangGraph."""
import os
import datetime
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from tools import TOOLS
from runlog import log

GRAPH_LOG = os.path.join("logs", "graph_compile.log")

SYSTEM_PROMPT = """You are the WISEUP tools catalog assistant, a friendly B2B assistant \
for a hand-tools and power-tools brand. The catalog is in Arabic and every product has a \
price in Jordanian dinars (JOD).

Tools you can use:
- retrieve_products: search the local Arabic product catalog (names, codes, prices). Use for \
any question about specific tools, what is available, or how much something costs.
- search_wiseup_web: search the official WISEUP website (wiseuptools.com). Use ONLY for \
company/website info that is NOT in the catalog.
- email_owner: send the customer's selected products and their contact details to the \
business owner as a lead.

Replying with products (IMPORTANT):
- When retrieve_products returns products, the user interface already shows them as visual \
cards (image, Arabic name, code, and price in JOD). Write only a SHORT, friendly intro of \
1-2 sentences that points to the cards below. You may mention prices in JOD when helpful.
- Do NOT list each product in your text. Do NOT use markdown bold or asterisks (**), and do \
NOT output numbered or bulleted product lists. The cards carry the details; your text only \
frames them.

Collecting an order / lead:
- When the customer signals they are finished or ready to proceed/order, FIRST ask them in a \
single message for their name, phone number, and email. You need their name and at least one \
of phone or email. The phone must be a Jordanian mobile starting with 077, 078, or 079 (10 \
digits); the email must contain @ and a dot. If what they give is not in this format, politely \
ask them to re-check before continuing.
- Once you have valid contact details, ask them to confirm: "Shall I send these N products to \
the owner?" Only call email_owner AFTER they reply yes, passing the product codes discussed \
plus the collected name, phone, and email.

General:
- Never invent codes, products, prices, or contact details.
- Prices are in JOD. Keep replies concise and friendly; reply in the customer's language."""


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    session_id: str
    retrieved_products: list[dict]


def agent_node(state: AgentState) -> dict:
    log("🤖 NODE agent: thinking...")
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3).bind_tools(TOOLS)
    ai = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    tool_calls = getattr(ai, "tool_calls", None) or []
    for tc in tool_calls:
        log(f"🤖 NODE agent: decided to CALL {tc['name']} with {tc['args']}")
    if not tool_calls:
        log("🤖 NODE agent: produced a final answer (no tool needed)")
    return {"messages": [ai]}


def route_agent(state: AgentState):
    """Same routing as the prebuilt tools_condition, but logs the decision."""
    decision = tools_condition(state)  # -> "tools" or END
    if decision == "tools":
        log("↪️  ROUTER: tool requested → go to 'tools', then LOOP back to agent")
    else:
        log("🏁 ROUTER: no tool requested → finish (exit the loop)")
    return decision


def _build_graph():
    builder = StateGraph(AgentState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(TOOLS, handle_tool_errors=True))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", route_agent, {"tools": "tools", END: END})
    builder.add_edge("tools", "agent")
    return builder.compile(checkpointer=MemorySaver())


def _log_graph_compile(compiled):
    """Write the compiled graph's structure to logs/graph_compile.log on startup.

    Records the nodes, edges (marking conditional ones), the bound tools, and a
    Mermaid + ASCII rendering, so you can see exactly how the graph compiled.
    Wrapped so a logging failure can never break app startup.
    """
    try:
        os.makedirs("logs", exist_ok=True)
        g = compiled.get_graph()
        nodes = list(g.nodes)
        lines = [
            "=" * 72,
            f"[{datetime.datetime.now().isoformat(timespec='seconds')}] GRAPH COMPILED OK",
            f"Nodes ({len(nodes)}): {nodes}",
            "Edges:",
        ]
        for e in g.edges:
            cond = "  (conditional)" if getattr(e, "conditional", False) else ""
            lines.append(f"  {getattr(e, 'source', '?')} -> {getattr(e, 'target', '?')}{cond}")
        lines.append("Tools bound: " + ", ".join(t.name for t in TOOLS))
        try:
            lines += ["", "Mermaid:", g.draw_mermaid()]
        except Exception as ex:
            lines.append(f"(mermaid render failed: {ex})")
        try:
            lines += ["", "ASCII:", g.draw_ascii()]
        except Exception as ex:
            lines.append(f"(ascii render needs the 'grandalf' package; skipped: {ex})")
        lines.append("")
        with open(GRAPH_LOG, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except Exception as ex:  # never break startup over a log line
        print(f"[graph_compile log] skipped: {ex}")


graph = _build_graph()
_log_graph_compile(graph)
