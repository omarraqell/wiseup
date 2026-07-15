"""One-shot: crawl WISEUP series names from the live site.

The site is English-only and shows no product codes, so this yields category
NAMES and nothing else. Arabic names come from translate_categories.py.
"""
import json
import os
import re
import sys
import requests
from bs4 import BeautifulSoup

INDEX_URL = "https://www.wiseuptools.com/h-col-103.html"
BASE = "https://www.wiseuptools.com"
OUT_PATH = "data/categories.raw.json"

# Category links look like: /h-pr--0_415_5.html  (the trailing number is the id)
_HREF_RE = re.compile(r"^/h-pr--0_415_(\d+)\.html$")


def parse_categories(html: str) -> list[dict]:
    """Extract {id, name_en, url} for each series link, in page order, deduped by id."""
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        m = _HREF_RE.match(a["href"].strip())
        if not m:
            continue
        cid = int(m.group(1))
        if cid in seen:
            continue
        name = (a.get("title") or a.get_text()).strip()
        if not name:
            continue
        seen.add(cid)
        out.append({"id": cid, "name_en": name, "url": BASE + a["href"].strip()})
    return out


def main():
    resp = requests.get(INDEX_URL, timeout=30,
                        headers={"User-Agent": "Mozilla/5.0 (WISEUP catalog build)"})
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding
    cats = parse_categories(resp.text)
    if not cats:
        print("ERROR: no categories parsed — the site markup changed.", file=sys.stderr)
        sys.exit(1)
    os.makedirs("data", exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(cats, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(cats)} categories to {OUT_PATH}")


if __name__ == "__main__":
    main()
