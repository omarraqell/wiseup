import fitz, re, json, sys, os
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
d = fitz.open('WISEUP 2025 New Product Catalog.pdf')
heads = json.load(open('_headers.json'))
os.makedirs('images', exist_ok=True)

def norm_series(s):
    if not s: return ''
    s=s.replace('LABORPROTECTION','LABOR PROTECTION').replace('WATERPUMP','WATER PUMP').replace('POLISHING/POLISHING','POLISHING')
    s=' '.join(t for t in s.split() if len(t)>1)
    s=s.replace('SAWS','SAW').replace('SCREWDRIVERSS','SCREWDRIVERS')
    return re.sub(r'\s+',' ',s).strip().title()

HEADER={'ITEM NO','ITEMNO','ITEM','NO','SIZE','G.W.','GW','G.W','CBM','PCS'}
def is_header(t): return t.upper().strip() in HEADER
def is_itemno_hdr(t): return t.upper().replace(' ','') in ('ITEMNO','ITEM')
def is_code(t): return bool(re.fullmatch(r'\d{6}', t))
def is_packing(t): return bool(re.fullmatch(r'\d{1,4}/\d{1,4}', t))
def is_size(t):
    u=t.upper(); return ('MM' in u) or ('INCH' in u) or ('"' in t) or ("'" in t) or bool(re.search(r'\d+\s*[*X]\s*\d+',u))
def is_cbm(t): return bool(re.fullmatch(r'0?\.\d+', t))
def is_num(t): return bool(re.fullmatch(r'\d+(\.\d+)?', t))
def is_material(t):
    u=t.upper()
    if re.search(r'\d+#', u): return True
    return any(k in u for k in ('CR-V','CRV','CR-MO','STEEL','NICK','CHROME','PLATED','POLISH','CARBON','ALUMIN','PLASTIC','RUBBER','IRON','BRASS','COPPER','PVC','PP','ABS'))
def is_brand(t): return t.upper().replace('*','').replace('®','').strip() in ('WISEUP','WISE UP')
def is_spec(t):
    u=t.upper()
    if ':' in t: return True
    return bool(re.search(r'\d+\s*(RPM|V|W|MAH|HZ|MIN)\b',u)) or any(k in u for k in ('SPEED','VOLTAGE','POWER','LODING','LOADING','CAPACITY','FREQUENCY'))

def box_xy(box):
    xs=[p[0] for p in box]; ys=[p[1] for p in box]
    return sum(xs)/4,sum(ys)/4,min(xs),max(xs),min(ys),max(ys)

def extract_page(i, save_img=True):
    page=d[i-1]; SC=2.5
    pix=page.get_pixmap(matrix=fitz.Matrix(SC,SC)); pix.save('_e.png')
    W,H=pix.width,pix.height
    res,_=ocr('_e.png')
    if not res: return []
    toks=[]
    for box,txt,conf in res:
        cx,cy,x0,x1,y0,y1=box_xy(box)
        toks.append({'t':txt.strip(),'cx':cx,'cy':cy,'col':min(2,int(cx/(W/3.0)))})
    series=norm_series(heads[str(i)]['name'])
    colw=W/3.0
    # blocks defined by ITEM NO headers
    headers=[t for t in toks if is_itemno_hdr(t['t'])]
    # crop image per block, store image path keyed by (col, header_cy)
    from PIL import Image
    img=Image.open('_e.png') if save_img else None
    block_imgpath={}
    for bi,h in enumerate(sorted(headers,key=lambda t:(t['col'],t['cy']))):
        col=h['col']; hy=h['cy']
        # title above this header in same col
        above=[t for t in toks if t['col']==col and t['cy']<hy-5 and not is_code(t['t']) and not is_header(t['t'])
               and not is_brand(t['t']) and not is_spec(t['t']) and not is_num(t['t']) and not is_packing(t['t'])
               and not is_size(t['t']) and not is_cbm(t['t']) and not is_material(t['t']) and len(t['t'])>=3]
        title_cy=max((t['cy'] for t in above), default=hy-300)
        if save_img:
            x0=int(col*colw)+6; x1=int((col+1)*colw)-6
            ytop=int(min(title_cy+55, hy-30)); ybot=int(hy-12)
            if ybot-ytop<40: ytop=int(hy-260)  # fallback region
            ytop=max(0,ytop); ybot=min(H,ybot)
            crop=img.crop((x0,ytop,x1,ybot))
            p=f'images/p{i:03d}_c{col}_{bi}.png'; crop.save(p)
            block_imgpath[(col,round(hy))]=p
    # assign each code to nearest header above in same col
    recs=[]
    hdr_by_col={}
    for h in headers: hdr_by_col.setdefault(h['col'],[]).append(h['cy'])
    for tk in toks:
        if not is_code(tk['t']): continue
        cx,cy,col=tk['cx'],tk['cy'],tk['col']
        right=[o for o in toks if o is not tk and abs(o['cy']-cy)<22 and o['cx']>cx and o['col']==col and not is_code(o['t'])]
        right.sort(key=lambda o:o['cx'])
        size=packing=gw=cbm=''
        for o in right:
            t=o['t']
            if is_packing(t) and not packing: packing=t
            elif is_size(t) and not size: size=t
            elif is_cbm(t) and not cbm: cbm=t
            elif is_num(t) and not gw: gw=t
        above=[o for o in toks if o['col']==col and o['cy']<cy-5 and not is_code(o['t']) and not is_header(o['t'])]
        above.sort(key=lambda o:-o['cy'])
        name=''; material=''
        for o in above:
            t=o['t']
            if is_num(t) or is_packing(t) or is_size(t) or is_cbm(t): continue
            if is_brand(t) or is_spec(t) or t.upper() in ('MAX','MIN','NEW','HOT','PCS'): continue
            if not material and is_material(t): material=t; continue
            if not name and len(t)>=4 and any(ch.isalpha() for ch in t) and not is_material(t): name=t; break
        # image: nearest header above this code in same col
        cand=[hy for hy in hdr_by_col.get(col,[]) if hy<cy+30]
        ip=''
        if cand:
            hy=max(cand); ip=block_imgpath.get((col,round(hy)),'')
        conf='high' if (name and (size or gw or cbm)) else 'low'
        recs.append({'item_no':tk['t'],'series':series,'product_name':name,'material':material,
                     'size':size,'packing':packing,'gross_weight':gw,'cbm':cbm,'pdf_page':i,
                     'image':ip,'confidence':conf})
    return recs

if __name__=='__main__':
    if sys.argv[1:]==['ALL']:
        import csv
        allrecs=[]; log=open('_extract2.log','w')
        for i in range(4,158):
            rs=extract_page(i); allrecs+=rs
            log.write(f'page {i}: {len(rs)}\n'); log.flush()
        best={}
        for r in allrecs:
            k=r['item_no']
            if k not in best or (r['confidence']=='high' and best[k]['confidence']=='low'): best[k]=r
        recs=list(best.values())
        json.dump(recs,open('products.json','w'),indent=1,ensure_ascii=False)
        cols=['item_no','series','product_name','material','size','packing','gross_weight','cbm','pdf_page','image','confidence']
        with open('products.csv','w',newline='',encoding='utf-8') as f:
            w=csv.DictWriter(f,fieldnames=cols); w.writeheader()
            for r in sorted(recs,key=lambda x:(x['pdf_page'],x['item_no'])): w.writerow(r)
        log.write(f'TOTAL {len(recs)}\n'); log.close()
        print('done',len(recs))
    else:
        for p in ([int(x) for x in sys.argv[1:]] or [6]):
            for r in extract_page(p): print(r['item_no'],'|',r['product_name'],'|',r['image'])
