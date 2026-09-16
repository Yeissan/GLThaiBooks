#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]; BOOKS=ROOT/'books'; OUT=ROOT/'data/catalog.json'
def j(p,d):
    try:return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else d
    except:return d
def rel(p):return p.relative_to(ROOT).as_posix()
def slug(s):return re.sub(r'[^a-z0-9]+','-',str(s).lower()).strip('-')
def first(folder,names):
    for n in names:
        p=folder/n
        if p.exists():return rel(p)
    return ''
def pdf(folder):
    xs=sorted(folder.glob('*.pdf')); return rel(xs[0]) if xs else ''
def book(folder,inherit=None,n=None):
    inherit=inherit or {}; d=j(folder/'libro.json',{})
    if not d:return None
    title=d.get('title') or folder.name
    return {'id':d.get('id') or slug((inherit.get('title','')+' '+title).strip()),'type':'book','title':title,'volume_number':d.get('number',n),'author':d.get('author') or inherit.get('author',''),'year':d.get('year',''),'language':d.get('language') or inherit.get('language',''),'publisher':d.get('publisher') or inherit.get('publisher',''),'genres':d.get('genres') or inherit.get('genres',[]),'description':d.get('description',''),'telegram_url':d.get('telegram_url',''),'pdf_url':d.get('pdf_url') or pdf(folder),'cover':first(folder,['cover.jpg','cover.jpeg','cover.png','folder.jpg','folder.png'])}
def saga(folder):
    d=j(folder/'saga.json',{}); title=d.get('title') or folder.name
    inherit={'title':title,'author':d.get('author',''),'language':d.get('language',''),'publisher':d.get('publisher',''),'genres':d.get('genres',[])}
    vols=[]
    for i,c in enumerate(sorted([p for p in folder.iterdir() if p.is_dir()],key=lambda p:p.name.lower()),1):
        b=book(c,inherit,i)
        if b:vols.append(b)
    vols.sort(key=lambda b:(b.get('volume_number') if isinstance(b.get('volume_number'),(int,float)) else 999999,b.get('title','')))
    return {'id':d.get('id') or slug(title),'type':'saga','title':title,'author':d.get('author',''),'year':d.get('year',''),'language':d.get('language',''),'publisher':d.get('publisher',''),'genres':d.get('genres',[]),'description':d.get('description',''),'cover':first(folder,['cover.jpg','cover.jpeg','cover.png','folder.jpg','folder.png']) or (vols[0].get('cover','') if vols else ''),'volumes':vols,'volume_count':len(vols)}
BOOKS.mkdir(parents=True,exist_ok=True); items=[]
for f in sorted([p for p in BOOKS.iterdir() if p.is_dir()],key=lambda p:p.name.lower()):
    x=saga(f) if (f/'saga.json').exists() else book(f)
    if x:items.append(x)
OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps({'books':items},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Generated {OUT} with {len(items)} items')
