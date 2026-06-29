import os
import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("RUN_LIVE"), reason="set RUN_LIVE=1 to hit real services")


def test_catalog_question_returns_products():
    from langchain_core.messages import HumanMessage
    from agent_graph import graph
    state = graph.invoke(
        {"messages": [HumanMessage("زرادية كهربا")], "session_id": "live1"},
        {"configurable": {"thread_id": "live1"}})
    assert state["messages"][-1].content
    assert state.get("retrieved_products")
