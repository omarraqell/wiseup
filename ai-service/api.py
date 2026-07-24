"""FastAPI AI service: serves RAG query processing, agent invoking, and session resetting."""
import json
import os
import time
import datetime
from typing import Optional
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from agent_graph import graph
from runlog import log, new_run
import catalog

app = FastAPI(title="WISEUP Catalog Assistant AI Microservice")

os.makedirs("logs", exist_ok=True)


def log_interaction(req, answer, n_products, top_score, latency_ms):
    rec = {
        "ts": datetime.datetime.now().isoformat(timespec="seconds"),
        "query": req.query, "k": req.k, "generate": req.generate,
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


class AskReq(BaseModel):
    query: str
    k: int = 9
    generate: bool = True
    session_id: Optional[str] = None


class ResetReq(BaseModel):
    session_id: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ask")
def ask(req: AskReq):
    t0 = time.time()
    thread = req.session_id or "default"
    new_run(f"HTTP /ask — message: «{req.query}»  (session: {thread})")
    config = {"configurable": {"thread_id": thread}}
    
    # We can pass req.k to tools or control retrieval limit if agent uses config
    # In agent_graph, retrieving uses search tools or similar, passing the session_id
    state = graph.invoke(
        {"messages": [HumanMessage(req.query)], "session_id": thread}, config)
    
    answer = state["messages"][-1].content
    products = state.get("retrieved_products", [])
    top_score = products[0].get("relevance") if products else None
    
    log(f"💬 NODE respond: final reply ready ({len(answer or '')} chars), "
        f"{len(products)} product card(s)")
    log(f"HTTP /ask — replying ({len(answer or '')} chars)")
    
    log_interaction(req, answer, len(products), top_score, int((time.time() - t0) * 1000))
    return {"answer": answer, "products": products}


@app.post("/reset")
def reset(req: ResetReq):
    # With the checkpointer, "resetting" means the client starts a new thread id.
    return {"ok": True, "session_id": req.session_id}
