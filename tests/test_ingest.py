import ingest_excel as ing


def test_is_product_accepts_real_row():
    assert ing.is_product("زرادية كهرباء صناعي 6\"", 2.5) is True


def test_is_product_rejects_header_and_blanks():
    assert ing.is_product("الصنف", "السعر") is False   # header: price not numeric
    assert ing.is_product("", 2.5) is False             # no name
    assert ing.is_product("x", None) is False           # no price
