import fitz, re, json, sys
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
d = fitz.open('WISEUP 2025 New Product Catalog.pdf')
heads = json.load(open('_headers.json'))

def norm_series(s):
    if not s: return ''
    s=s.replace('LABORPROTECTION','LABOR PROTECTION').replace('WATERPUMP','WATER PUMP').replace('POLISHING/POLISHING','POLISHING')
    s=' '.join(t for t in s.split() if len(t)>1)
    s=s.replace('SAWS','SAW').replace('SCREWDRIVERSS','SCREWDRIVERS')
    return re.sub(r'\s+',' ',s).strip().title()

HEADER = {'ITEM NO','ITEMNO','ITEM','NO','SIZE','G.W.','GW','G.W','CBM','PCS'}
def is_header(t): return t.upper().strip() in HEADER
def is_code(t): return bool(re.fullmatch(r'\d{6}', t))
def is_packing(t): return bool(re.fullmatch(r'\d{1,4}/\d{1,4}', t))
def is_size(t):
    u=t.upper()
    return ('MM' in u) or ('INCH' in u) or ('"' in t) or ("'" in t) or bool(re.search(r'\d+\s*[*X]\s*\d+',u))
def is_cbm(t):
    return bool(re.fullmatch(r'0?\.\d+', t))
def is_num(t): return bool(re.fullmatch(r'\d+(\.\d+)?', t))
def is_material(t):
    u=t.upper()
    if re.search(r'\d+#', u): return True
    for kw in ('CR-V','CRV','CR-MO','STEEL','NICK','CHROME','PLATED','POLISH','CARBON','ALUMIN','PLASTIC','RUBBER','IRON','BRASS','COPPER','PVC','PP','ABS'):
        if kw in u: return True
    return False
def is_brand(t): return t.upper().replace('*','').replace('®','').strip() in ('WISEUP','WISE UP')
def is_spec(t):
    u=t.upper()
    if ':' in t: return True
    return bool(re.search(r'\d+\s*(RPM|V|W|MAH|MM|HZ|MIN|°C)\b', u)) or any(k in u for k in ('SPEED','VOLTAGE','POWER','LODING','LOADING','CAPACITY','FREQUENCY'))

def carea(box):
    xs=[p[0] for p in box]; ys=[p[1] for p in box]
    return (sum(xs)/4, sum(ys)/4, min(xs), max(xs))

def extract_page(i):
    page=d[i-1]; pix=page.get_pixmap(matrix=fitz.Matrix(2.5,2.5)); pix.save('_e.png')
    W=pix.width
    res,_=ocr('_e.png')
    toks=[]
    if not res: return []
    for box,txt,conf in res:
        cx,cy,x0,x1=carea(box)
        toks.append({'t':txt.strip(),'cx':cx,'cy':cy,'col':min(2,int(cx/(W/3.0)))})
    series=norm_series(heads[str(i)]['name'])
    recs=[]
    for tk in toks:
        if not is_code(tk['t']): continue
        cx,cy,col=tk['cx'],tk['cy'],tk['col']
        # same-row right tokens within same column band
        right=[o for o in toks if o is not tk and abs(o['cy']-cy)<22 and o['cx']>cx and o['col']==col and not is_code(o['t'])]
        right.sort(key=lambda o:o['cx'])
        size=packing=gw=cbm=''
        for o in right:
            t=o['t']
            if is_packing(t) and not packing: packing=t
            elif is_size(t) and not size: size=t
            elif is_cbm(t) and not cbm: cbm=t
            elif is_num(t) and not gw: gw=t
        # title + material above in same column
        above=[o for o in toks if o['col']==col and o['cy']<cy-5 and not is_code(o['t']) and not is_header(o['t'])]
        above.sort(key=lambda o:-o['cy'])  # nearest first
        name=''; material=''
        for o in above:
            t=o['t']
            if is_num(t) or is_packing(t) or is_size(t) or is_cbm(t): continue
            if is_brand(t) or is_spec(t) or t.upper() in ('MAX','MIN','NEW','HOT','PCS'): continue
            if not material and is_material(t): material=t; continue
            if not name and len(t)>=4 and any(ch.isalpha() for ch in t) and not is_material(t):
                name=t; break
        conf='high' if (name and (size or gw or cbm)) else 'low'
        recs.append({'item_no':tk['t'],'series':series,'product_name':name,'material':material,
                     'size':size,'packing':packing,'gross_weight':gw,'cbm':cbm,'pdf_page':i,'confidence':conf})
    return recs

def run_all():
    import csv
    allrecs=[]
    log=open('_extract_progress.log','w')
    for i in range(4,158):
        rs=extract_page(i)
        allrecs+=rs
        log.write(f'page {i}: {len(rs)} items\n'); log.flush()
    # dedupe by item_no (keep first high-confidence else first)
    best={}
    for r in allrecs:
        k=r['item_no']
        if k not in best or (r['confidence']=='high' and best[k]['confidence']=='low'):
            best[k]=r
    recs=list(best.values())
    json.dump(recs, open('products.json','w'), indent=1, ensure_ascii=False)
    cols=['item_no','series','product_name','material','size','packing','gross_weight','cbm','pdf_page','confidence']
    with open('products.csv','w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=cols); w.writeheader()
        for r in sorted(recs,key=lambda x:(x['pdf_page'],x['item_no'])): w.writerow(r)
    hi=sum(1 for r in recs if r['confidence']=='high')
    log.write(f'TOTAL {len(recs)} unique items, {hi} high-confidence\n'); log.close()

if __name__=='__main__':
    if sys.argv[1:]==['ALL']:
        run_all()
    else:
        pgs=[int(x) for x in sys.argv[1:]] or [6]
        for p in pgs:
            for r in extract_page(p): print(r)
