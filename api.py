"""FastAPI backend: serves the WISEUP frontend, product images, and the RAG endpoints."""
import json
import os
import time
import datetime
from typing import Optional
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import rag
import memory

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


def to_card(doc, score):
    m = doc.metadata
    img = m.get("image", "")
    return {
        "item_no": m.get("item_no", ""),
        "product_name": m.get("product_name") or "Product",
        "product_name_ar": m.get("product_name_ar", ""),
        "series": m.get("series", ""),
        "series_ar": m.get("series_ar", ""),
        "material": m.get("material", ""),
        "material_ar": m.get("material_ar", ""),
        "size": m.get("size", ""),
        "packing": m.get("packing", ""),
        "gross_weight": m.get("gross_weight", ""),
        "cbm": m.get("cbm", ""),
        "pdf_page": m.get("pdf_page", ""),
        "image_url": ("/" + img.replace("\\", "/")) if img else "",
        # Chroma returns L2 distance (smaller = closer); map to a 0-100 feel
        "relevance": max(5, min(100, round((1 - score / 2) * 100))),
    }


@app.get("/")
def index():
    return FileResponse("frontend/index.html")


@app.get("/series")
def series():
    return SERIES


@app.post("/ask")
def ask(req: AskReq):
    t0 = time.time()
    history = memory.short_term(req.session_id) if req.session_id else []
    answer, results, search_q = rag.answer_with_memory(
        req.query, history, k=req.k, series=req.series, generate=req.generate)
    products = [to_card(d, s) for d, s in results]
    top_score = round(results[0][1], 3) if results else None
    # record the turn (long-term memory)
    if req.session_id:
        memory.add(req.session_id, "user", req.query)
        memory.add(req.session_id, "assistant", answer or f"(showed {len(products)} products)")
    log_interaction(req, answer, len(products), top_score, int((time.time() - t0) * 1000))
    return {"answer": answer, "products": products, "search_query": search_q}


@app.post("/reset")
def reset(req: ResetReq):
    memory.reset(req.session_id)
    return {"ok": True}
