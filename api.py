"""FastAPI backend: serves the WISEUP frontend, product images, and the RAG endpoints."""
import json
import os
import time
import datetime
from typing import Optional
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from agent_graph import graph

app = FastAPI(title="WISEUP Catalog Assistant")
app.mount("/images", StaticFiles(directory="images"), name="images")

os.makedirs("logs", exist_ok=True)


def log_interaction(req, answer, n_products, top_score, latency_ms):
    rec = {
        "ts": datetime.datetime.now().isoformat(timespec="seconds"),
        "query": req.query, "k": req.k, "series": req.series, "generate": req.generate,
        "n_products": n_products, "top_score": top_score, "latency_ms": latency_ms,
        "answer": answer,
    }
    with open("logs/interactions.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    with open("logs/interactions.log", "a", encoding="utf-8") as f:
        f.write(f"[{rec['ts']}] Q: {req.query!r}  (gen={req.generate}, products={n_products}, "
                f"top={top_score}, {latency_ms}ms)\n")
        if answer:
            f.write(f"           A: {answer}\n")

_products = json.load(open("products.json", encoding="utf-8"))
SERIES = sorted({p["series"] for p in _products if p.get("series")})


class AskReq(BaseModel):
    query: str
    k: int = 9
    series: Optional[list[str]] = None
    generate: bool = True
    session_id: Optional[str] = None


class ResetReq(BaseModel):
    session_id: str


@app.get("/")
def index():
    return FileResponse("frontend/index.html")


@app.get("/series")
def series():
    return SERIES


@app.post("/ask")
def ask(req: AskReq):
    t0 = time.time()
    thread = req.session_id or "default"
    config = {"configurable": {"thread_id": thread}}
    state = graph.invoke(
        {"messages": [HumanMessage(req.query)], "session_id": thread}, config)
    answer = state["messages"][-1].content
    products = state.get("retrieved_products", [])
    top_score = products[0].get("relevance") if products else None
    log_interaction(req, answer, len(products), top_score, int((time.time() - t0) * 1000))
    return {"answer": answer, "products": products}


@app.post("/reset")
def reset(req: ResetReq):
    # With the checkpointer, "resetting" means the client starts a new thread id.
    return {"ok": True, "session_id": req.session_id}
