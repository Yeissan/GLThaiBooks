#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
BOOKS=ROOT/'books'
OUT=ROOT/'data'/'catalog.json'

def safe_json(path,default):
    try:return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default
    except Exception:return default

def rel(path):return path.relative_to(ROOT).as_posix()

def slug(text):return re.sub(r'[^a-z0-9]+','-',text.lower()).strip('-')

def first_file(folder,names):
    for n in names:
        p=folder/n
        if p.exists():return rel(p)
    return ''

def first_pdf(folder):
    pdfs=sorted(folder.glob('*.pdf'))
    return rel(pdfs[0]) if pdfs else ''

def build_book(folder):
    d=safe_json(folder/'libro.json',{})
    if not d:return None
    title=d.get('title') or folder.name
    return {
        'id':d.get('id') or slug(title),
        'title':title,
        'author':d.get('author',''),
        'year':d.get('year',''),
        'language':d.get('language',''),
        'publisher':d.get('publisher',''),
        'genres':d.get('genres',[]),
        'description':d.get('description',''),
        'telegram_url':d.get('telegram_url',''),
        'pdf_url':d.get('pdf_url') or first_pdf(folder),
        'cover':first_file(folder,['cover.jpg','cover.jpeg','cover.png','folder.jpg','folder.png'])
    }

BOOKS.mkdir(parents=True,exist_ok=True)
items=[]
for folder in sorted(p for p in BOOKS.iterdir() if p.is_dir()):
    x=build_book(folder)
    if x:items.append(x)
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps({'books':items},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Generated {OUT} with {len(items)} books')
