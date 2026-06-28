import json, re
from collections import OrderedDict

heads = json.load(open('_headers.json'))
codes = json.load(open('_ocr_codes.json'))

def norm(s):
    if not s: return ''
    s = s.replace('LABORPROTECTION','LABOR PROTECTION')
    s = s.replace('WATERPUMP','WATER PUMP')
    s = s.replace('POLISHING/POLISHING','POLISHING')
    # remove stray single letters between words (OCR noise): "PLIERS S SERIES" -> "PLIERS SERIES"
    s = re.sub(r'\b([A-Z])\b(?<!\bS\b SERIES)', '', s)  # placeholder
    # simpler: drop lone single letters
    toks = [t for t in s.split() if not (len(t)==1)]
    s = ' '.join(toks)
    s = s.replace('SAWS','SAW').replace('SCREWDRIVERSS','SCREWDRIVERS')
    s = re.sub(r'\s+',' ', s).strip()
    return s

# build per-page series with carry-forward across blank/divider pages (only after first real header)
pages = {}
last = ''
for i in range(1, 161):
    raw = heads[str(i)]['name']
    n = norm(raw)
    if n:
        last = n
        pages[i] = n
    else:
        pages[i] = ''  # blank: decide by codes

# carry-forward: a blank page that HAS codes belongs to previous series
series = OrderedDict()
ranges = {}
prev = ''
for i in range(1, 161):
    n = pages[i]
    cds = [c for c in codes.get(str(i), []) if len(c)==6 and c.isdigit()]
    if not n:
        if cds and prev:   # continuation page
            n = prev
        else:
            continue       # cover/divider with no products
    prev = n
    series.setdefault(n, set()).update(cds)
    ranges.setdefault(n, []).append(i)

print(f'{"SERIES":35} {"ITEMS":>6}  PAGES(pdf)')
print('-'*75)
total=0
order=[]
for n, cset in series.items():
    pgs=ranges[n]
    rng=f'{min(pgs)}-{max(pgs)}'
    print(f'{n:35} {len(cset):>6}  {rng}')
    total+=len(cset)
    order.append((n,len(cset)))
print('-'*75)
print(f'{"DISTINCT SERIES = "+str(len(series)):35} {total:>6} items (sum)')
allu=set()
for s in series.values(): allu|=s
print('unique items overall:', len(allu))
json.dump({n:sorted(c) for n,c in series.items()}, open('_series_items.json','w'))
