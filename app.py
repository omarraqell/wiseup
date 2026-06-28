"""WISEUP catalog RAG — type a question, get a Gemma-generated answer + product cards with images."""
import os
import streamlit as st
import rag  # single source for store + Gemma LLM

st.set_page_config(page_title="WISEUP Catalog Search", page_icon="🔧", layout="wide")


@st.cache_resource
def store():
    return rag.get_store()


@st.cache_resource
def llm():
    return rag.get_llm()


st.title("🔧 WISEUP 2025 Catalog Assistant")
st.caption("Ask in natural language — e.g. *circlip pliers and sizes*, *adjustable wrench 12 inch*, *water pump*.")

# sidebar
all_series = sorted({m["series"] for m in store().get()["metadatas"] if m.get("series")})
with st.sidebar:
    st.header("Options")
    series_pick = st.multiselect("Filter by series", all_series)
    k = st.slider("Products to retrieve", 1, 30, 8)
    gen = st.toggle("Generate AI answer (Gemma)", value=True,
                    help="Off = fast search only. On = Gemma writes an answer (slower on CPU).")

query = st.text_input("Ask about products", placeholder="e.g. what circlip pliers do you have and what sizes?")

if query:
    flt = series_pick or None
    if gen:
        with st.spinner("Searching + asking Gemma…"):
            llm()  # warm cache
            answer, results = rag.answer(query, k=k, series=flt)
        st.subheader("💬 Answer")
        st.markdown(answer)
        st.divider()
    else:
        results = rag.retrieve(query, k=k, series=flt)

    st.subheader(f"📦 {len(results)} matching products")
    cols = st.columns(3)
    for i, (doc, score) in enumerate(results):
        m = doc.metadata
        with cols[i % 3]:
            with st.container(border=True):
                img = m.get("image", "")
                if img and os.path.exists(img):
                    st.image(img, use_container_width=True)
                else:
                    st.markdown("🔧 *(no image)*")
                st.markdown(f"### {m.get('product_name') or 'Product'}")
                st.markdown(f"**{m.get('series','')}**")
                st.write(m.get("description", ""))
                bits = []
                if m.get("size"): bits.append(f"📏 {m['size']}")
                if m.get("material"): bits.append(f"🧱 {m['material']}")
                if m.get("packing"): bits.append(f"📦 {m['packing']}")
                if m.get("gross_weight"): bits.append(f"⚖️ {m['gross_weight']}")
                if m.get("cbm"): bits.append(f"🧊 {m['cbm']}")
                if bits:
                    st.caption("  •  ".join(bits))
                st.code(f"Item No: {m['item_no']}  |  page {m.get('pdf_page','?')}", language=None)
                st.progress(max(0.0, min(1.0, 1 - score / 2)), text=f"relevance {1 - score/2:.0%}")
else:
    st.info("Type a question above to get an answer and matching product cards.")
