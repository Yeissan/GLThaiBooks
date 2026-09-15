
const app = document.getElementById('app');
let catalog = [];
let pdfjsLib = null;
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

function setHash(v){ location.hash = v; }

function progressKey(id){
  return `glthai_book_progress_${id}`;
}

async function getProgress(id){
  const key = progressKey(id);

  if (tg?.CloudStorage?.getItem) {
    try {
      const value = await new Promise((resolve, reject) => {
        tg.CloudStorage.getItem(key, (err, value) => err ? reject(err) : resolve(value));
      });
      if (value) return JSON.parse(value);
    } catch (_) {}
  }

  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_) {
    return null;
  }
}

async function saveProgress(id, data){
  const key = progressKey(id);
  const value = JSON.stringify(data);

  try {
    localStorage.setItem(key, value);
  } catch (_) {}

  if (tg?.CloudStorage?.setItem) {
    try {
      await new Promise((resolve, reject) => {
        tg.CloudStorage.setItem(key, value, err => err ? reject(err) : resolve());
      });
    } catch (_) {}
  }
}

function pct(page, total){
  if (!total || total < 1) return 0;
  return Math.max(0, Math.min(100, Math.round((page / total) * 100)));
}

async function renderCatalog(){
  app.innerHTML = `
    <div class="topbar">
      <div>
        <div class="brand">GL Thai Books 📚</div>
        <div class="sub">Selecciona un libro</div>
      </div>
    </div>
    <input id="q" class="search" placeholder="Buscar libro, autor o género…" autocomplete="off">
    <div id="grid" class="grid"></div>
    <div class="footer-note">El progreso se guarda automáticamente.</div>
  `;

  const q = document.getElementById('q');
  const grid = document.getElementById('grid');

  async function paint(){
    const x = q.value.trim().toLowerCase();
    const rows = catalog.filter(b =>
      [b.title,b.author,b.year,(b.genres||[]).join(' ')].join(' ').toLowerCase().includes(x)
    );

    if (!rows.length) {
      grid.innerHTML = `<div class="empty">No encontré libros.</div>`;
      return;
    }

    const cards = await Promise.all(rows.map(async b => {
      const p = await getProgress(b.id);
      const percent = p?.total ? pct(p.page, p.total) : 0;
      const status = percent >= 100 ? '✅ Terminado' : percent > 0 ? `📖 ${percent}% leído` : '📘 Sin empezar';

      return `
        <button class="card" data-id="${esc(b.id)}">
          <img src="${esc(b.cover || '')}" alt="Portada de ${esc(b.title)}">
          <div class="meta">
            <h3>${esc(b.title)}</h3>
            <p>${esc(b.author || '')}${b.year ? ' • ' + esc(b.year) : ''}</p>
            <div class="progress-row">
              <div class="progress-label">
                <span>${status}</span>
                <span>${percent}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${percent}%"></div>
              </div>
            </div>
          </div>
        </button>`;
    }));

    grid.innerHTML = cards.join('');

    grid.querySelectorAll('.card').forEach(btn => {
      btn.addEventListener('click', () => setHash('libro=' + encodeURIComponent(btn.dataset.id)));
    });
  }

  q.addEventListener('input', paint);
  paint();
}

function info(label, val){
  return val ? `<div class="info-item"><b>${esc(label)}</b>${esc(val)}</div>` : '';
}

async function renderBook(id){
  const b = catalog.find(x => x.id === id);
  if (!b) return renderCatalog();

  const p = await getProgress(b.id);
  const percent = p?.total ? pct(p.page, p.total) : 0;
  const resumeText = percent > 0 && percent < 100
    ? `Continuar por la página ${p.page} · ${percent}% leído`
    : percent >= 100
      ? 'Volver a leer · 100% completado'
      : 'Empezar a leer';

  app.innerHTML = `
    <div class="topbar">
      <button class="back" id="back">← Libros</button>
      <div>
        <div class="brand">${esc(b.title)}</div>
        <div class="sub">Ficha del libro</div>
      </div>
    </div>

    <img class="book-cover" src="${esc(b.cover || '')}" alt="Portada de ${esc(b.title)}">
    <h1 class="title">${esc(b.title)}</h1>
    ${b.author ? `<div class="author">✍️ ${esc(b.author)}</div>` : ''}

    <div class="chips">
      ${[b.year,b.language,...(b.genres||[])].filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('')}
    </div>

    <p class="plot">${esc(b.description || '')}</p>

    <div class="info-grid">
      ${info('Autor', b.author)}
      ${info('Año', b.year)}
      ${info('Idioma', b.language)}
      ${info('Editorial', b.publisher)}
    </div>

    <button class="read-link" id="open-reader">
      <span>
        <span class="read-name">📖 ${esc(resumeText)}</span>
      </span>
      <span class="read-arrow">→</span>
    </button>
  `;

  document.getElementById('back').addEventListener('click', () => setHash(''));
  document.getElementById('open-reader').addEventListener('click', () => {
    setHash('leer=' + encodeURIComponent(b.id));
  });
}

async function ensurePdfJs(){
  if (pdfjsLib) return pdfjsLib;

  pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

  return pdfjsLib;
}

async function renderReader(id){
  const b = catalog.find(x => x.id === id);
  if (!b) return renderCatalog();

  app.innerHTML = `
    <div class="reader-shell">
      <div class="topbar">
        <button class="back" id="back-book">← ${esc(b.title)}</button>
        <div>
          <div class="brand">${esc(b.title)}</div>
          <div class="sub">Lector</div>
        </div>
      </div>

      <div id="resume" class="resume-banner">Preparando lector…</div>

      <div class="reader-status">
        <span id="page-label">Página — de —</span>
        <span id="percent-label">0% leído</span>
      </div>
      <div class="reader-progress"><div id="reader-progress-fill"></div></div>

      <div class="reader-toolbar">
        <button id="prev" type="button">← Anterior</button>
        <input id="page-input" type="number" min="1" value="1" inputmode="numeric" aria-label="Ir a página">
        <button id="go" type="button">Ir</button>
        <button id="next" type="button">Siguiente →</button>
      </div>

      <div id="reader-message" class="reader-error" style="display:none"></div>
      <div class="canvas-wrap">
        <canvas id="pdf-canvas"></canvas>
      </div>
      <div class="reader-hint">Tu página se guarda automáticamente para continuar donde la dejaste.</div>
    </div>
  `;

  document.getElementById('back-book').addEventListener('click', () => setHash('libro=' + encodeURIComponent(id)));

  const pdfUrl = b.pdf_url || b.reader_url || '';
  const msg = document.getElementById('reader-message');

  if (!pdfUrl) {
    document.querySelector('.canvas-wrap').style.display = 'none';
    document.querySelector('.reader-toolbar').style.display = 'none';
    document.querySelector('.reader-status').style.display = 'none';
    document.querySelector('.reader-progress').style.display = 'none';
    document.getElementById('resume').style.display = 'none';
    msg.style.display = 'block';
    msg.innerHTML = `
      Este libro todavía no tiene <b>pdf_url</b> para el lector.<br><br>
      Cuando conectemos el backend con Telegram, el bot añadirá esa URL automáticamente sin mover el PDF de Telegram.
    `;
    return;
  }

  try {
    const pdfjs = await ensurePdfJs();
    const loadingTask = pdfjs.getDocument({ url: pdfUrl });
    const pdf = await loadingTask.promise;

    const saved = await getProgress(id);
    let currentPage = Math.min(Math.max(saved?.page || 1, 1), pdf.numPages);
    let rendering = false;
    let pending = null;

    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const pageInput = document.getElementById('page-input');
    const pageLabel = document.getElementById('page-label');
    const percentLabel = document.getElementById('percent-label');
    const progressFill = document.getElementById('reader-progress-fill');
    const prev = document.getElementById('prev');
    const next = document.getElementById('next');
    const resume = document.getElementById('resume');

    if (saved?.page > 1) {
      resume.textContent = `Continuando desde la página ${currentPage}.`;
    } else {
      resume.textContent = `Empezando desde la página 1.`;
    }

    async function draw(pageNum){
      if (rendering) {
        pending = pageNum;
        return;
      }

      rendering = true;
      const page = await pdf.getPage(pageNum);

      const base = page.getViewport({ scale: 1 });
      const wrap = document.querySelector('.canvas-wrap');
      const targetWidth = Math.max(260, Math.min(wrap.clientWidth - 18, 860));
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;

      await page.render({
        canvasContext: ctx,
        viewport,
        transform
      }).promise;

      currentPage = pageNum;
      pageInput.value = currentPage;
      pageInput.max = pdf.numPages;
      pageLabel.textContent = `Página ${currentPage} de ${pdf.numPages}`;

      const percent = pct(currentPage, pdf.numPages);
      percentLabel.textContent = `${percent}% leído`;
      progressFill.style.width = `${percent}%`;

      prev.disabled = currentPage <= 1;
      next.disabled = currentPage >= pdf.numPages;

      await saveProgress(id, {
        page: currentPage,
        total: pdf.numPages,
        percent,
        updated_at: Date.now()
      });

      rendering = false;

      if (pending !== null && pending !== currentPage) {
        const p = pending;
        pending = null;
        draw(p);
      } else {
        pending = null;
      }
    }

    prev.addEventListener('click', () => {
      if (currentPage > 1) draw(currentPage - 1);
    });

    next.addEventListener('click', () => {
      if (currentPage < pdf.numPages) draw(currentPage + 1);
    });

    document.getElementById('go').addEventListener('click', () => {
      const n = Math.floor(Number(pageInput.value));
      if (!Number.isFinite(n)) return;
      draw(Math.min(Math.max(n, 1), pdf.numPages));
    });

    pageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('go').click();
    });

    draw(currentPage);
  } catch (err) {
    document.querySelector('.canvas-wrap').style.display = 'none';
    document.querySelector('.reader-toolbar').style.display = 'none';
    msg.style.display = 'block';
    msg.textContent = `No se pudo abrir el PDF en el lector: ${err?.message || err}`;
  }
}

async function route(){
  const reader = location.hash.match(/^#leer=(.+)$/);
  if (reader) return renderReader(decodeURIComponent(reader[1]));

  const book = location.hash.match(/^#libro=(.+)$/);
  if (book) return renderBook(decodeURIComponent(book[1]));

  return renderCatalog();
}

fetch('data/catalog.json', { cache:'no-store' })
  .then(r => {
    if (!r.ok) throw new Error('No se pudo cargar data/catalog.json');
    return r.json();
  })
  .then(d => {
    catalog = d.books || [];
    route();
  })
  .catch(err => {
    app.innerHTML = `<div class="error"><b>No pude cargar la biblioteca.</b><br>${esc(err.message)}</div>`;
  });

window.addEventListener('hashchange', route);

