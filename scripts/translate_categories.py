"""One-shot: add Arabic names to the crawled categories.

The site has no Arabic, so category_ar is translated, not crawled.
27 items = one LLM call. Owner reviews data/categories.json afterwards.
"""
import json
from dotenv import load_dotenv
load_dotenv()
from langchain_openai import ChatOpenAI
from scripts._llm import call_json, save_json

IN_PATH = "data/categories.raw.json"
OUT_PATH = "data/categories.json"

PROMPT = """You translate hand-tool product category names from English to Arabic.
These are categories in a Jordanian hardware/tools catalog. Use the Arabic trade
vocabulary a Jordanian tool shop would actually use, not literal dictionary Arabic.

Return ONLY a JSON object mapping each id (as a string) to its Arabic name.
No markdown, no commentary.

Categories:
{items}
"""


def merge_translations(raw: list[dict], names_ar: dict) -> list[dict]:
    """Attach name_ar to each category by id. Raises if any category is untranslated."""
    out = []
    for c in raw:
        ar = (names_ar.get(str(c["id"])) or "").strip()
        if not ar:
            raise ValueError(f"no Arabic name returned for category id {c['id']} "
                             f"({c['name_en']!r})")
        out.append({**c, "name_ar": ar})
    return out


def main():
    raw = json.load(open(IN_PATH, encoding="utf-8"))
    items = "\n".join(f'{c["id"]}: {c["name_en"]}' for c in raw)
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    out = merge_translations(raw, call_json(llm, PROMPT.format(items=items)))
    save_json(OUT_PATH, out)
    print(f"wrote {len(out)} categories with Arabic names to {OUT_PATH}")


if __name__ == "__main__":
    main()
