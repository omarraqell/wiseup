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
