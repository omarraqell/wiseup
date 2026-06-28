"""RAG over the WISEUP catalog: retrieve products (Chroma) then generate an
answer with OpenAI GPT-4o mini.

Embeddings are pluggable via WISEUP_EMBED_BACKEND:
  - "openai": text-embedding-3-small (multilingual, e.g. Arabic + English)
  - "hf":     local all-MiniLM-L6-v2 (free, English-centric) -- the fallback
Each backend has its own Chroma folder/collection (vector spaces differ), so
switching does NOT require deleting the other index.
"""
import os
from langchain_chroma import Chroma
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

CHAT_MODEL = os.environ.get("WISEUP_CHAT_MODEL", "gpt-4o-mini")
EMBED_BACKEND = os.environ.get("WISEUP_EMBED_BACKEND", "openai").lower()  # "openai" | "hf"
HF_EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
OPENAI_EMBED_MODEL = os.environ.get("WISEUP_EMBED_MODEL", "text-embedding-3-small")

_store = None
_llm = None


def get_embeddings():
    """Embedding function for the active backend."""
    if EMBED_BACKEND == "openai":
        from langchain_openai import OpenAIEmbeddings
        if not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
        return OpenAIEmbeddings(model=OPENAI_EMBED_MODEL)
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(model_name=HF_EMBED_MODEL)


def store_config():
    """(persist_dir, collection_name) for the active backend."""
    if EMBED_BACKEND == "openai":
        return "./chroma_db_openai", "wiseup_products_openai"
    return "./chroma_db", "wiseup_products"


def get_store():
    global _store
    if _store is None:
        persist, collection = store_config()
        _store = Chroma(persist_directory=persist, collection_name=collection,
                        embedding_function=get_embeddings())
    return _store


def get_llm(max_tokens=400, temperature=0.3):
    """Cached ChatOpenAI (GPT-4o mini). API key comes from OPENAI_API_KEY."""
    global _llm
    if _llm is None:
        if not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
        _llm = ChatOpenAI(model=CHAT_MODEL, temperature=temperature, max_tokens=max_tokens)
    return _llm


def chat(user_text, system=None, max_tokens=400, temperature=0.3):
    """Generate via LangChain's ChatOpenAI (GPT-4o mini).

    `system` carries the assistant's role, instructions and any retrieved
    context / conversation history; `user_text` is the user's actual turn.
    Returns the AIMessage content.
    """
    llm = get_llm().bind(max_tokens=max_tokens, temperature=temperature)
    messages = []
    if system:
        messages.append(SystemMessage(content=system))
    messages.append(HumanMessage(content=user_text))
    ai = llm.invoke(messages)          # -> AIMessage
    return (ai.content or "").strip()


def retrieve(query, k=8, series=None):
    flt = {"series": {"$in": series}} if series else None
    # The index is bilingual (EN + AR doc per product), so over-fetch then
    # dedupe by item_no, keeping each product's best (smallest) distance.
    raw = get_store().similarity_search_with_score(query, k=k * 3, filter=flt)
    best = {}
    for doc, score in raw:
        key = doc.metadata.get("item_no") or id(doc)
        if key not in best or score < best[key][1]:
            best[key] = (doc, score)
    out = sorted(best.values(), key=lambda x: x[1])
    return out[:k]


def build_context(results):
    lines = []
    for doc, _ in results:
        m = doc.metadata
        lines.append(
            f"- {m.get('product_name') or 'Product'} | series: {m.get('series','')} | "
            f"material: {m.get('material','')} | size: {m.get('size','')} | "
            f"packing: {m.get('packing','')} | G.W.: {m.get('gross_weight','')} | "
            f"CBM: {m.get('cbm','')} | item_no: {m.get('item_no','')} | page: {m.get('pdf_page','')}"
        )
    return "\n".join(lines)


# Chroma L2 distance: <= this means a genuine product match; above = small talk / off-topic.
# Tuned per embedding backend (different models -> different distance scales).
RELEVANCE_THRESHOLD = float(os.environ.get(
    "WISEUP_REL_THRESHOLD", "1.35" if EMBED_BACKEND == "openai" else "1.2"))

# --- System prompts: role + instructions + (optionally) retrieved context.
# The user's actual turn is always sent separately as the HumanMessage.

PROMPT_SYS = """You are the WISEUP tools catalog assistant. Using ONLY the products listed below, write a \
short, friendly, natural-language reply (1-3 sentences) that answers the customer's question. Mention the \
relevant products with their sizes and item numbers. Do NOT just copy the list verbatim; summarise helpfully.
{history}
PRODUCTS:
{context}"""

CHAT_SYS = """You are the WISEUP tools catalog assistant — a friendly B2B assistant for a hand-tools and \
power-tools brand. The user's message does not match a specific product in the catalog. Reply briefly and \
naturally in 1-2 sentences. If it is a greeting or small talk, greet them back and invite them to ask about \
WISEUP tools (e.g. pliers, wrenches, drills, measuring tools, saws). Do NOT invent any products or item numbers."""

CONTEXTUALIZE_SYS = """Given the recent conversation and a new user message, rewrite the new message as a \
short standalone search query (a few keywords) for a tools product catalog. Resolve references like "it", \
"that one", "the 7 inch one", and expand abbreviations (e.g. "mat"->"material") into the product being \
discussed (e.g. "what is the mat" after talking about circlip pliers -> "circlip pliers material"). \
If the message is already standalone, a greeting, or small talk, return it unchanged. Output ONLY the query.

CONVERSATION:
{history}"""

FOLLOWUP_SYS = """You are the WISEUP tools catalog assistant. Continue the conversation and answer the \
user's latest message using the product details already discussed. Be concise and friendly, and keep \
citing item numbers where relevant. If the answer truly isn't in the conversation, briefly ask them to \
specify which product or tool they mean. Do NOT invent item numbers or products.

CONVERSATION:
{history}"""


def _history_text(history):
    if not history:
        return ""
    return "\n".join(f"{t['role'].title()}: {t['content']}" for t in history)


def _history_block(history):
    txt = _history_text(history)
    return f"\nRECENT CONVERSATION (for context only):\n{txt}\n" if txt else ""


def contextualize(history, query):
    """Rewrite a follow-up into a standalone search query using recent turns."""
    if not history:
        return query
    rewritten = chat(query, system=CONTEXTUALIZE_SYS.format(history=_history_text(history)),
                     max_tokens=40, temperature=0.0)
    rewritten = rewritten.strip().strip('"').splitlines()[0] if rewritten.strip() else ""
    return rewritten or query


def gate(results):
    """Keep only genuine product matches (distance below threshold)."""
    return [(d, s) for d, s in results if s <= RELEVANCE_THRESHOLD]


def answer(query, k=8, series=None):
    """Returns (answer_text, relevant_results). If nothing relevant, replies
    conversationally and returns NO products (no pictures)."""
    results = retrieve(query, k=k, series=series)
    relevant = gate(results)
    if relevant:
        system = PROMPT_SYS.format(history="", context=build_context(relevant))
    else:
        system = CHAT_SYS
    return chat(query, system=system), relevant


def answer_with_memory(query, history, k=8, series=None, generate=True):
    """Memory-aware answer: contextualizes the query with recent turns, retrieves,
    and (optionally) generates a reply that is aware of the conversation.
    Returns (answer_text, relevant_results, search_query_used)."""
    search_q = contextualize(history, query)
    relevant = gate(retrieve(search_q, k=k, series=series))
    if not generate:
        return "", relevant, search_q
    if relevant:
        system = PROMPT_SYS.format(history=_history_block(history),
                                   context=build_context(relevant))
    elif history:
        # follow-up about already-discussed products: answer from the conversation
        system = FOLLOWUP_SYS.format(history=_history_text(history))
    else:
        system = CHAT_SYS
    return chat(query, system=system), relevant, search_q


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "what circlip pliers do you have and what sizes?"
    ans, res = answer(q)
    print("Q:", q, "\n")
    print("ANSWER:\n", ans, "\n")
    print("RETRIEVED:")
    for doc, score in res:
        m = doc.metadata
        print(f"  {m['item_no']}  {m.get('product_name','')}  {m.get('size','')}")
