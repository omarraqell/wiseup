import build_index


def test_describe_includes_name_and_code():
    s = build_index.describe({"name_ar": "زرادية كهرباء", "code": "10101"})
    assert "زرادية كهرباء" in s and "10101" in s


def test_clean_meta_keeps_new_schema_keys():
    m = build_index.clean_meta({"code": "10101", "name_ar": "زرادية", "unit": "pcs",
                                "price_jod": 2.5, "image": "images/10101.png"})
    assert m["code"] == "10101"
    assert m["name_ar"] == "زرادية"
    assert m["unit"] == "pcs"
    assert m["price_jod"] == 2.5
    assert m["image"] == "images/10101.png"
