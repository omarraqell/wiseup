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
