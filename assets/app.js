const app=document.getElementById('app');
let catalog=[];
let pdfjsLib=null;
const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(page,total)=>total?Math.max(0,Math.min(100,Math.round(page/total*100))):0;
const progressKey=id=>`glthai_book_progress_${id}`;
function setHash(v){location.hash=v}

async function getProgress(id){
  const key=progressKey(id);
  if(tg?.CloudStorage?.getItem){
    try{
      const value=await new Promise((resolve,reject)=>tg.CloudStorage.getItem(key,(err,v)=>err?reject(err):resolve(v)));
      if(value)return JSON.parse(value);
    }catch(_){}
  }
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}
}

async function saveProgress(id,data){
  const key=progressKey(id),value=JSON.stringify(data);
  try{localStorage.setItem(key,value)}catch(_){}
  if(tg?.CloudStorage?.setItem){
    try{await new Promise((resolve,reject)=>tg.CloudStorage.setItem(key,value,err=>err?reject(err):resolve()))}catch(_){}
  }
}

function displayValue(v){return(v===null||v===undefined||v==='')?'—':String(v)}
function formatStatus(v){
  return({pendiente_verificacion:'Pendiente de verificación',parcialmente_verificada:'Parcialmente verificada',verificada:'Verificada'}[v]||displayValue(v));
}
function info(label,val){return`<div class="info-item"><b>${esc(label)}</b>${esc(displayValue(val))}</div>`}

function coverCard(b){
  if(b.cover)return`<img src="${esc(b.cover)}" alt="Portada de ${esc(b.title)}">`;
  return`<div class="card-cover-placeholder"><span>📚</span><small>Sin portada</small></div>`;
}
function coverDetail(b){
  if(b.cover)return`<img class="book-cover" src="${esc(b.cover)}" alt="Portada de ${esc(b.title)}">`;
  return`<div class="cover-placeholder"><span>📚</span><strong>${esc(b.title)}</strong></div>`;
}

async function renderCatalog(){
  app.className='app';
  app.innerHTML=`
    <div class="topbar"><div><div class="brand">GL Thai Books 📚</div><div class="sub">${catalog.length} libros en catálogo</div></div></div>
    <input id="q" class="search" placeholder="Buscar libro, autor o género…" autocomplete="off">
    <div class="catalog-tools">
      <button class="filter active" data-filter="all" type="button">Todos</button>
      <button class="filter" data-filter="available" type="button">Disponibles</button>
      <button class="filter" data-filter="coming" type="button">Próximamente</button>
    </div>
    <div id="grid" class="grid"></div>`;
  const q=document.getElementById('q'),grid=document.getElementById('grid');
  let filter='all';

  async function paint(){
    const term=q.value.trim().toLowerCase();
    let rows=catalog.filter(b=>[b.title,b.original_title,b.author,b.year,...(b.genres||[])].join(' ').toLowerCase().includes(term));
    if(filter==='available')rows=rows.filter(b=>b.available);
    if(filter==='coming')rows=rows.filter(b=>!b.available);

    if(!rows.length){grid.innerHTML=`<div class="empty">No encontré libros.</div>`;return}
    const html=await Promise.all(rows.map(async b=>{
      const p=await getProgress(b.id);
      const percent=p?.total?pct(p.page,p.total):0;
      const state=b.available?(percent>=100?'✅ Terminado':percent>0?`📖 ${percent}% leído`:'📖 Disponible'):'📚 Próximamente';
      return`<button class="card" data-id="${esc(b.id)}" type="button">
        ${coverCard(b)}
        <div class="meta">
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.author||'Autor pendiente')}${b.year?' • '+esc(b.year):''}</p>
          ${b.available?`<div class="progress-row"><div class="progress-label"><span>${state}</span><span>${percent}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div>`:`<div class="coming-label">${state}</div>`}
        </div>
      </button>`;
    }));
    grid.innerHTML=html.join('');
    grid.querySelectorAll('.card').forEach(btn=>btn.addEventListener('click',()=>setHash('libro='+encodeURIComponent(btn.dataset.id))));
  }

  q.addEventListener('input',paint);
  document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');filter=btn.dataset.filter;paint();
  }));
  paint();
}

async function renderBook(id){
  const b=catalog.find(x=>x.id===id);if(!b)return renderCatalog();
  const p=await getProgress(id);
  const percent=p?.total?pct(p.page,p.total):0;

  const action=b.available?`
    <button class="read-link" id="open-reader" type="button">
      <span><span class="read-name">📖 ${percent>0&&percent<100?`Continuar por la página ${p.page}`:percent>=100?'Volver a leer':'Empezar a leer'}</span><span class="read-sub">${percent}% leído</span></span>
      <span class="read-arrow">→</span>
    </button>`:`
    <div class="coming-panel"><strong>📚 Próximamente</strong><span>El PDF todavía no está disponible.</span></div>`;

  const sources=(b.sources||[]).length?`<div class="sources-box"><h3>Fuentes</h3>${b.sources.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">Fuente ${i+1}</a>`).join('')}</div>`:'';

  app.className='app';
  app.innerHTML=`
    <div class="topbar"><button class="back" id="back" type="button">← Libros</button><div><div class="brand">${esc(b.title)}</div><div class="sub">Ficha del libro</div></div></div>
    ${coverDetail(b)}
    <h1 class="title">${esc(b.title)}</h1>
    ${b.original_title?`<div class="original-title">${esc(b.original_title)}</div>`:''}
    <div class="author">${b.author?`✍️ ${esc(b.author)}`:'✍️ Autor pendiente'}</div>
    <div class="chips">${[b.year,b.language,b.original_language,...(b.genres||[])].filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>

    <section class="detail-section">
      <h2>Descripción</h2>
      <p class="plot">${esc(b.description||'Descripción pendiente de verificación.')}</p>
    </section>

    <section class="detail-section">
      <h2>Ficha</h2>
      <div class="info-grid">
        ${info('Autor',b.author)}
        ${info('Año',b.year)}
        ${info('Idioma de lectura',b.language)}
        ${info('Idioma original',b.original_language)}
        ${info('Saga',b.saga)}
        ${info('Volumen',b.volume)}
        ${info('ISBN',b.isbn)}
        ${info('Adaptación',b.adaptation)}
        ${info('Estado de ficha',formatStatus(b.record_status))}
      </div>
    </section>
    ${sources}
    ${action}`;

  document.getElementById('back').addEventListener('click',()=>setHash(''));
  document.getElementById('open-reader')?.addEventListener('click',()=>setHash('leer='+encodeURIComponent(id)));
}

async function ensurePdfJs(){
  if(pdfjsLib)return pdfjsLib;
  pdfjsLib=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  return pdfjsLib;
}

async function renderReader(id){
  const b=catalog.find(x=>x.id===id);if(!b)return renderCatalog();
  app.className='';
  app.innerHTML=`
    <div class="reader-fullscreen" id="reader-fullscreen">
      <div class="reader-top">
        <button class="back" id="back-book" type="button">← Volver</button>
        <div class="reader-title-mini"><strong>${esc(b.title)}</strong><span id="top-page-label">Preparando lector…</span></div>
      </div>
      <div class="reader-page-area" id="reader-page-area">
        <canvas id="pdf-canvas"></canvas>
        <button class="tap-zone tap-zone-left" id="tap-left" type="button" aria-label="Página anterior"></button>
        <div class="reader-center-zone" id="tap-center"></div>
        <button class="tap-zone tap-zone-right" id="tap-right" type="button" aria-label="Página siguiente"></button>
        <div class="page-turn-hint">Toca izquierda o derecha para pasar página</div>
        <div class="zoom-badge" id="zoom-badge">100%</div>
      </div>
      <div class="reader-bottom">
        <div class="reader-bottom-row"><span id="page-label">Página — de —</span><span id="percent-label">0% leído</span></div>
        <div class="reader-progress"><div id="reader-progress-fill"></div></div>
      </div>
    </div>`;

  const full=document.getElementById('reader-fullscreen'),pageArea=document.getElementById('reader-page-area'),canvas=document.getElementById('pdf-canvas'),ctx=canvas.getContext('2d');
  const tapLeft=document.getElementById('tap-left'),tapRight=document.getElementById('tap-right'),tapCenter=document.getElementById('tap-center');
  const pageLabel=document.getElementById('page-label'),topPageLabel=document.getElementById('top-page-label'),percentLabel=document.getElementById('percent-label'),progressFill=document.getElementById('reader-progress-fill'),zoomBadge=document.getElementById('zoom-badge');
  document.getElementById('back-book').addEventListener('click',()=>setHash('libro='+encodeURIComponent(id)));

  if(!b.pdf_url){pageArea.innerHTML=`<div class="reader-error">Este libro todavía no tiene un PDF disponible.</div>`;return}

  try{
    const pdf=await (await ensurePdfJs()).getDocument({url:b.pdf_url}).promise;
    const saved=await getProgress(id);
    let currentPage=Math.min(Math.max(saved?.page||1,1),pdf.numPages),rendering=false,pending=null;
    let zoom=1,panX=0,panY=0,pinchStartDistance=0,pinchStartZoom=1,panStartX=0,panStartY=0,panOriginX=0,panOriginY=0,touchStartX=null,touchStartY=null;

    const dist=(a,b)=>Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    const apply=()=>{canvas.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;zoomBadge.textContent=`${Math.round(zoom*100)}%`;full.classList.toggle('zoomed',zoom>1.01)};
    const resetZoom=()=>{zoom=1;panX=0;panY=0;apply()};

    async function draw(n){
      n=Math.min(Math.max(n,1),pdf.numPages);
      if(rendering){pending=n;return}
      rendering=true;
      try{
        const page=await pdf.getPage(n),base=page.getViewport({scale:1});
        const scale=Math.min(pageArea.clientWidth/base.width,pageArea.clientHeight/base.height);
        const viewport=page.getViewport({scale});
        const dpr=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);
        canvas.style.width=`${Math.floor(viewport.width)}px`;canvas.style.height=`${Math.floor(viewport.height)}px`;
        await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
        currentPage=n;resetZoom();
        const percent=pct(n,pdf.numPages);
        pageLabel.textContent=`Página ${n} de ${pdf.numPages}`;
        topPageLabel.textContent=`Página ${n} de ${pdf.numPages}`;
        percentLabel.textContent=`${percent}% leído`;
        progressFill.style.width=`${percent}%`;
        tapLeft.disabled=n<=1;tapRight.disabled=n>=pdf.numPages;
        await saveProgress(id,{page:n,total:pdf.numPages,percent,updated_at:Date.now()});
      }finally{
        rendering=false;
        if(pending!==null&&pending!==currentPage){const p=pending;pending=null;draw(p)}else pending=null;
      }
    }

    const prev=()=>currentPage>1&&draw(currentPage-1),next=()=>currentPage<pdf.numPages&&draw(currentPage+1);
    tapLeft.addEventListener('click',prev);tapRight.addEventListener('click',next);
    tapCenter.addEventListener('click',()=>full.classList.toggle('reader-ui-hidden'));

    pageArea.addEventListener('touchstart',e=>{
      if(e.touches.length===2){pinchStartDistance=dist(e.touches[0],e.touches[1]);pinchStartZoom=zoom;return}
      if(e.touches.length===1){
        const t=e.touches[0];
        if(zoom>1.01){panStartX=t.clientX;panStartY=t.clientY;panOriginX=panX;panOriginY=panY}
        else{touchStartX=t.clientX;touchStartY=t.clientY}
      }
    },{passive:false});

    pageArea.addEventListener('touchmove',e=>{
      if(e.touches.length===2){
        e.preventDefault();
        zoom=Math.max(1,Math.min(4,pinchStartZoom*(dist(e.touches[0],e.touches[1])/pinchStartDistance)));
        if(zoom<=1.01){zoom=1;panX=0;panY=0}
        apply();return;
      }
      if(e.touches.length===1&&zoom>1.01){
        e.preventDefault();const t=e.touches[0];
        panX=panOriginX+(t.clientX-panStartX);panY=panOriginY+(t.clientY-panStartY);apply();
      }
    },{passive:false});

    pageArea.addEventListener('touchend',e=>{
      if(zoom>1.01){touchStartX=null;touchStartY=null;return}
      if(touchStartX===null||!e.changedTouches?.length)return;
      const t=e.changedTouches[0],dx=t.clientX-touchStartX,dy=t.clientY-touchStartY;
      touchStartX=null;touchStartY=null;
      if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy))return;
      dx<0?next():prev();
    },{passive:false});

    canvas.addEventListener('dblclick',()=>{if(zoom>1.01)resetZoom();else{zoom=2;apply()}});
    await draw(currentPage);
  }catch(err){
    pageArea.innerHTML=`<div class="reader-error">No se pudo abrir el PDF: ${esc(err?.message||err)}</div>`;
  }
}

async function route(){
  const r=location.hash.match(/^#leer=(.+)$/);if(r)return renderReader(decodeURIComponent(r[1]));
  const b=location.hash.match(/^#libro=(.+)$/);if(b)return renderBook(decodeURIComponent(b[1]));
  return renderCatalog();
}

fetch('data/catalog.json',{cache:'no-store'})
.then(r=>{if(!r.ok)throw new Error('No se pudo cargar data/catalog.json');return r.json()})
.then(d=>{catalog=d.books||[];route()})
.catch(err=>{app.innerHTML=`<div class="error"><b>No pude cargar la biblioteca.</b><br>${esc(err.message)}</div>`});

window.addEventListener('hashchange',route);
