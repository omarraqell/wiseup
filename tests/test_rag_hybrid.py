import rag
import build_index


def test_describe_and_clean_meta():
    p = {"code": "10104", "name_ar": "زرادية كهرباء", "unit": "pcs",
         "price_jod": 1.85, "image": "images/10104.png"}
    assert rag.describe(p) == "زرادية كهرباء (كود 10104)"
    meta = rag.clean_meta(p)
    assert meta == {"code": "10104", "name_ar": "زرادية كهرباء", "unit": "pcs",
                    "price_jod": 1.85, "image": "images/10104.png"}


def test_build_index_uses_shared_builders():
    # build_index must reuse rag's builders so BM25 and Chroma docs stay identical.
    assert build_index.describe is rag.describe
    assert build_index.clean_meta is rag.clean_meta
