import fitz, re, json
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
d = fitz.open('WISEUP 2025 New Product Catalog.pdf')
heads = {}
log = open('_hdr_progress.log', 'w')
for i in range(d.page_count):
    page = d[i]
    r = page.rect
    clip = fitz.Rect(r.x0, r.y0, r.x1, r.y0 + r.height*0.12)
    pix = page.get_pixmap(matrix=fitz.Matrix(3.0,3.0), clip=clip)
    pix.save('_hdr_tmp.png')
    res,_ = ocr('_hdr_tmp.png')
    toks = []
    if res:
        for box,t,_ in res:
            t=t.strip()
            if not t: continue
            if t.upper() in ('WISEUP','WISEUP*','WISEUP®'): continue
            if re.fullmatch(r'\d{1,3}', t): continue  # corner page number
            toks.append(t.upper())
    raw = ' '.join(toks)
    # extract "<words> SERIES" phrase
    m = re.search(r'([A-Z][A-Z/&\- ]*\bSERIES)', raw)
    name = re.sub(r'\s+',' ', m.group(1)).strip() if m else ''
    heads[i+1] = {'name': name, 'raw': raw}
    log.write(f'page {i+1}: {name!r}  | raw={raw!r}\n'); log.flush()
json.dump(heads, open('_headers.json','w'))
log.write('DONE\n'); log.close()
