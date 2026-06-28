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
