from langchain_core.documents import Document
from langgraph.types import Command
import tools


def test_retrieve_products_returns_command_with_cards(monkeypatch):
    doc = Document(page_content="زرادية", metadata={
        "code": "10101", "name_ar": "زرادية كهرباء صناعي 6\"", "unit": "pcs",
        "price_jod": 2.5, "image": "images/10101.png"})
    monkeypatch.setattr(tools.rag, "retrieve", lambda q, k=8: [(doc, 0.4)])
    monkeypatch.setattr(tools.rag, "gate", lambda results: results)

    cmd = tools.retrieve_products.func(query="زرادية", tool_call_id="tc1")

    assert isinstance(cmd, Command)
    assert cmd.update["retrieved_products"][0]["code"] == "10101"
    assert cmd.update["retrieved_products"][0]["price_jod"] == 2.5
    msg = cmd.update["messages"][0]
    assert msg.tool_call_id == "tc1"
    assert "زرادية" in msg.content
