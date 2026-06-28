import fitz, re, json
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
d = fitz.open('WISEUP 2025 New Product Catalog.pdf')
mat = fitz.Matrix(2.0, 2.0)
out = {}
log = open('_ocr_progress.log', 'w')
for i in range(d.page_count):
    pix = d[i].get_pixmap(matrix=mat)
    tmp = '_ocr_tmp.png'
    pix.save(tmp)
    res, _ = ocr(tmp)
    codes = []
    if res:
        for box, txt, conf in res:
            t = txt.strip().replace(' ', '')
            if re.fullmatch(r'\d{5,7}[A-Za-z]?', t):
                codes.append(t)
    out[i+1] = codes
    log.write(f'page {i+1}/160: {len(codes)} codes\n'); log.flush()
    if (i+1) % 10 == 0 or i == d.page_count-1:
        json.dump(out, open('_ocr_codes.json','w'))  # incremental save
log.write('DONE\n'); log.flush(); log.close()
json.dump(out, open('_ocr_codes.json','w'))
