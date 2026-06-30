from langchain_core.messages import HumanMessage, AIMessage
import agent_graph
import rag


def test_graph_returns_final_answer_when_no_tool_calls(monkeypatch):
    class FakeLLM:
        def bind_tools(self, tools, **kw): return self
        def invoke(self, messages): return AIMessage(content="Hello from WISEUP!")

    monkeypatch.setattr(agent_graph, "ChatOpenAI", lambda **kw: FakeLLM())

    state = agent_graph.graph.invoke(
        {"messages": [HumanMessage("hi")], "session_id": "t1"},
        {"configurable": {"thread_id": "t1"}})

    assert state["messages"][-1].content == "Hello from WISEUP!"


def test_graph_survives_two_parallel_retrieve_calls(monkeypatch):
    """The model can fire retrieve_products twice in one step; both tool calls
    write retrieved_products. Without a reducer this raises InvalidUpdateError and
    poisons the session. The state key must merge concurrent writes cleanly."""
    monkeypatch.setattr(rag, "retrieve", lambda q, k=8: [])
    monkeypatch.setattr(rag, "gate", lambda results: results)
    monkeypatch.setattr(rag, "build_context", lambda results: "ctx")

    class FakeLLM:
        calls = 0
        def bind_tools(self, tools, **kw): return self
        def invoke(self, messages):
            FakeLLM.calls += 1
            if FakeLLM.calls == 1:
                return AIMessage(content="", tool_calls=[
                    {"name": "retrieve_products", "args": {"query": "a"},
                     "id": "call_1", "type": "tool_call"},
                    {"name": "retrieve_products", "args": {"query": "b"},
                     "id": "call_2", "type": "tool_call"},
                ])
            return AIMessage(content="Here are the results.")

    monkeypatch.setattr(agent_graph, "ChatOpenAI", lambda **kw: FakeLLM())

    state = agent_graph.graph.invoke(
        {"messages": [HumanMessage("find a and b")], "session_id": "par"},
        {"configurable": {"thread_id": "par"}})

    assert state["messages"][-1].content == "Here are the results."
