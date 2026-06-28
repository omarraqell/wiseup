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
