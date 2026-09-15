# GLThaiBooksReader

Versión con lector PDF integrado y progreso automático.

## Lo que ya hace
- Catálogo
- Ficha de libro
- Lector PDF con PDF.js
- Página anterior / siguiente
- Ir a página
- Porcentaje leído
- Guarda la última página automáticamente
- Al volver a abrir el libro continúa donde se dejó
- Intenta guardar progreso en Telegram CloudStorage y usa localStorage como respaldo

## Cada libro
`books/NOMBRE/libro.json`

```json
{
  "title": "Título",
  "author": "Autor",
  "year": "2024",
  "language": "Español",
  "publisher": "",
  "genres": ["Romance", "GL"],
  "description": "Descripción...",
  "telegram_url": "https://t.me/c/...",
  "pdf_url": "https://TU-BACKEND/..."
}
```

`pdf_url` NO debe ser el enlace normal `t.me/c/...`.
Debe ser una URL HTTP(S) que entregue el PDF al lector.

El siguiente paso es crear el backend que obtiene el PDF desde Telegram sin exponer el token del bot.
