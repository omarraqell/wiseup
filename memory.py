"""Conversation memory for the WISEUP RAG assistant.

Two tiers:
  - SHORT-TERM: the most recent turns (working memory), used in prompts + query
    contextualization. Bounded by SHORT_TERM_TURNS so prompts stay small.
  - LONG-TERM: the full session history persisted to disk per session_id, so it
    survives server restarts and is reloaded when the same session returns.
"""
import json
import os
import threading

DIR = "memory_store"
os.makedirs(DIR, exist_ok=True)
SHORT_TERM_TURNS = 6           # how many recent messages count as working memory

_lock = threading.Lock()
_cache = {}                    # session_id -> [{"role","content"}, ...]


def _path(sid):
    safe = "".join(c for c in sid if c.isalnum() or c in "-_")[:64] or "default"
    return os.path.join(DIR, f"{safe}.json")


def load(sid):
    """Full (long-term) history for a session, rehydrated from disk if needed."""
    if sid in _cache:
        return _cache[sid]
    hist = []
    p = _path(sid)
    if os.path.exists(p):
        try:
            hist = json.load(open(p, encoding="utf-8"))
        except Exception:
            hist = []
    _cache[sid] = hist
    return hist


def short_term(sid):
    """The recent working-memory window."""
    return load(sid)[-SHORT_TERM_TURNS:]


def add(sid, role, content):
    with _lock:
        h = load(sid)
        h.append({"role": role, "content": content})
        json.dump(h, open(_path(sid), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def reset(sid):
    with _lock:
        _cache[sid] = []
        p = _path(sid)
        if os.path.exists(p):
            os.remove(p)
