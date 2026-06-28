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
