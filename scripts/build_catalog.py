#!/usr/bin/env python3
from pathlib import Path
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
BOOKS = ROOT / "books"
MASTER = ROOT / "data" / "gl_thai_books_catalogo.json"
OUT = ROOT / "data" / "catalog.json"

def read_json(path, default):
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as e:
        print(f"WARN {path}: {e}")
        return default

def rel(path):
    return path.relative_to(ROOT).as_posix()

def normalize(text):
    text = str(text or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def find_cover(folder):
    for name in ("cover.jpg","cover.jpeg","cover.png","folder.jpg","folder.jpeg","folder.png"):
        p = folder / name
        if p.exists():
            return rel(p)
    return ""

def find_pdf(folder):
    pdfs = sorted(folder.glob("*.pdf"))
    return rel(pdfs[0]) if pdfs else ""

def load_override(folder):
    d = read_json(folder / "libro.json", {})
    return d if isinstance(d, dict) else {}

def find_matching_folder(book):
    if not BOOKS.exists():
        return None
    candidates = {
        normalize(book.get("slug")),
        normalize(book.get("titulo")),
        normalize(str(book.get("titulo") or "").replace(" and ", " & ")),
        normalize(str(book.get("titulo") or "").replace(" & ", " and ")),
    }
    candidates.discard("")
    for folder in BOOKS.iterdir():
        if not folder.is_dir():
            continue
        if normalize(folder.name) in candidates:
            return folder
        ov = load_override(folder)
        ovs = {
            normalize(ov.get("id")),
            normalize(ov.get("slug")),
            normalize(ov.get("title")),
            normalize(ov.get("titulo")),
        }
        if candidates & ovs:
            return folder
    return None

def merge_book(book):
    folder = find_matching_folder(book)
    ov = load_override(folder) if folder else {}
    cover = find_cover(folder) if folder else ""
    pdf_url = (ov.get("pdf_url") or find_pdf(folder)) if folder else ""
    return {
        "id": str(book.get("slug") or normalize(book.get("titulo"))),
        "catalog_id": book.get("id"),
        "slug": book.get("slug"),
        "title": book.get("titulo") or "",
        "original_title": book.get("titulo_original"),
        "author": book.get("autor"),
        "year": book.get("anio"),
        "language": book.get("idioma_app"),
        "original_language": book.get("idioma_original"),
        "genres": book.get("generos") or [],
        "description": book.get("descripcion_es"),
        "saga": book.get("saga"),
        "volume": book.get("volumen"),
        "isbn": book.get("isbn"),
        "adaptation": book.get("adaptacion"),
        "record_status": book.get("estado_ficha"),
        "sources": book.get("fuentes") or [],
        "cover": cover,
        "pdf_url": pdf_url,
        "telegram_url": ov.get("telegram_url", "") if folder else "",
        "pages": ov.get("pages") if folder else None,
        "available": bool(pdf_url),
        "folder": rel(folder) if folder else ""
    }

def main():
    master = read_json(MASTER, {})
    books = master.get("libros", []) if isinstance(master, dict) else []
    if not isinstance(books, list):
        raise RuntimeError("El catálogo maestro no contiene una lista 'libros' válida.")
    items = [merge_book(book) for book in books]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "catalog": master.get("catalogo", "GL Thai Books"),
        "language": master.get("idioma_catalogo", "es"),
        "version": master.get("version"),
        "updated_at": master.get("fecha_actualizacion"),
        "total_books": len(items),
        "books": items
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    available = sum(1 for x in items if x["available"])
    print(f"Generated {len(items)} books ({available} available).")

if __name__ == "__main__":
    main()
