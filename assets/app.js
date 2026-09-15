
const app=document.getElementById('app');
let catalog=[];
let pdfjsLib=null;
const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setHash(v){location.hash=v}
function progressKey(id){return `glthai_book_progress_${id}`}

async function getProgress(id){
  const key=progressKey(id);
  if(tg?.CloudStorage?.getItem){
    try{
      const value=await new Promise((resolve,reject)=>{
        tg.CloudStorage.getItem(key,(err,value)=>err?reject(err):resolve(value));
      });
      if(value)return JSON.parse(value);
    }catch(_){}
  }
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}
}

async function saveProgress(id,data){
  const key=progressKey(id),value=JSON.stringify(data);
  try{localStorage.setItem(key,value)}catch(_){}
  if(tg?.CloudStorage?.setItem){
    try{
      await new Promise((resolve,reject)=>{
        tg.CloudStorage.setItem(key,value,err=>err?reject(err):resolve());
      });
    }catch(_){}
  }
}
function pct(page,total){return total?Math.max(0,Math.min(100,Math.round(page/total*100))):0}

async function renderCatalog(){
  app.className='app';
  app.innerHTML=`
    <div class="topbar"><div><div class="brand">GL Thai Books 📚</div><div class="sub">Selecciona un libro</div></div></div>
    <input id="q" class="search" placeholder="Buscar libro, autor o género…" autocomplete="off">
    <div id="grid" class="grid"></div>`;
  const q=document.getElementById('q'),grid=document.getElementById('grid');
  async function paint(){
    const x=q.value.trim().toLowerCase();
    const rows=catalog.filter(b=>[b.title,b.author,b.year,(b.genres||[]).join(' ')].join(' ').toLowerCase().includes(x));
    if(!rows.length){grid.innerHTML=`<div class="empty">No encontré libros.</div>`;return}
    const cards=await Promise.all(rows.map(async b=>{
      const p=await getProgress(b.id);
      const percent=p?.total?pct(p.page,p.total):0;
      const status=percent>=100?'✅ Terminado':percent>0?`📖 ${percent}% leído`:'📘 Sin empezar';
      return `<button class="card" data-id="${esc(b.id)}"><img src="${esc(b.cover||'')}" alt="Portada de ${esc(b.title)}"><div class="meta"><h3>${esc(b.title)}</h3><p>${esc(b.author||'')}${b.year?' • '+esc(b.year):''}</p><div class="progress-row"><div class="progress-label"><span>${status}</span><span>${percent}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div></div></button>`;
    }));
    grid.innerHTML=cards.join('');
    grid.querySelectorAll('.card').forEach(btn=>btn.addEventListener('click',()=>setHash('libro='+encodeURIComponent(btn.dataset.id))));
  }
  q.addEventListener('input',paint);paint();
}

function info(label,val){return val?`<div class="info-item"><b>${esc(label)}</b>${esc(val)}</div>`:''}

async function renderBook(id){
  const b=catalog.find(x=>x.id===id);if(!b)return renderCatalog();
  const p=await getProgress(id);const percent=p?.total?pct(p.page,p.total):0;
  const resume=percent>0&&percent<100?`Continuar por la página ${p.page}`:percent>=100?'Volver a leer':'Empezar a leer';
  app.className='app';
  app.innerHTML=`
    <div class="topbar"><button class="back" id="back">← Libros</button><div><div class="brand">${esc(b.title)}</div><div class="sub">Ficha del libro</div></div></div>
    <img class="book-cover" src="${esc(b.cover||'')}" alt="Portada de ${esc(b.title)}">
    <h1 class="title">${esc(b.title)}</h1>
    ${b.author?`<div class="author">✍️ ${esc(b.author)}</div>`:''}
    <div class="chips">${[b.year,b.language,...(b.genres||[])].filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
    <p class="plot">${esc(b.description||'')}</p>
    <div class="info-grid">${info('Autor',b.author)}${info('Año',b.year)}${info('Idioma',b.language)}${info('Editorial',b.publisher)}</div>
    <button class="read-link" id="open-reader"><span class="read-name">📖 ${esc(resume)}</span><span class="read-arrow">→</span></button>`;
  document.getElementById('back').addEventListener('click',()=>setHash(''));
  document.getElementById('open-reader').addEventListener('click',()=>setHash('leer='+encodeURIComponent(id)));
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
      </div>
      <div class="reader-bottom">
        <div class="reader-bottom-row"><span id="page-label">Página — de —</span><span id="percent-label">0% leído</span></div>
        <div class="reader-progress"><div id="reader-progress-fill"></div></div>
      </div>
    </div>`;

  const full=document.getElementById('reader-fullscreen');
  const pageArea=document.getElementById('reader-page-area');
  const canvas=document.getElementById('pdf-canvas');
  const ctx=canvas.getContext('2d');
  const tapLeft=document.getElementById('tap-left'),tapRight=document.getElementById('tap-right');
  const tapCenter=document.getElementById('tap-center');
  const pageLabel=document.getElementById('page-label');
  const topPageLabel=document.getElementById('top-page-label');
  const percentLabel=document.getElementById('percent-label');
  const progressFill=document.getElementById('reader-progress-fill');

  document.getElementById('back-book').addEventListener('click',()=>setHash('libro='+encodeURIComponent(id)));

  const pdfUrl=b.pdf_url||b.reader_url||'';
  if(!pdfUrl){
    pageArea.innerHTML=`<div class="reader-error">Este libro todavía no tiene una URL de PDF válida para el lector.</div>`;
    return;
  }

  try{
    const pdfjs=await ensurePdfJs();
    const pdf=await pdfjs.getDocument({url:pdfUrl}).promise;
    const saved=await getProgress(id);
    let currentPage=Math.min(Math.max(saved?.page||1,1),pdf.numPages);
    let rendering=false,pending=null,touchStartX=null,touchStartY=null;

    async function draw(pageNum){
      pageNum=Math.min(Math.max(pageNum,1),pdf.numPages);
      if(rendering){pending=pageNum;return}
      rendering=true;
      try{
        const page=await pdf.getPage(pageNum);
        const base=page.getViewport({scale:1});
        const maxW=Math.max(250,pageArea.clientWidth);
        const maxH=Math.max(250,pageArea.clientHeight);
        const fitScale=Math.min(maxW/base.width,maxH/base.height);
        const viewport=page.getViewport({scale:fitScale});
        const dpr=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.floor(viewport.width*dpr);
        canvas.height=Math.floor(viewport.height*dpr);
        canvas.style.width=`${Math.floor(viewport.width)}px`;
        canvas.style.height=`${Math.floor(viewport.height)}px`;
        await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
        currentPage=pageNum;
        const percent=pct(currentPage,pdf.numPages);
        pageLabel.textContent=`Página ${currentPage} de ${pdf.numPages}`;
        topPageLabel.textContent=`Página ${currentPage} de ${pdf.numPages}`;
        percentLabel.textContent=`${percent}% leído`;
        progressFill.style.width=`${percent}%`;
        tapLeft.disabled=currentPage<=1;
        tapRight.disabled=currentPage>=pdf.numPages;
        await saveProgress(id,{page:currentPage,total:pdf.numPages,percent,updated_at:Date.now()});
      }finally{
        rendering=false;
        if(pending!==null&&pending!==currentPage){const p=pending;pending=null;draw(p)}else pending=null;
      }
    }

    const prev=()=>currentPage>1&&draw(currentPage-1);
    const next=()=>currentPage<pdf.numPages&&draw(currentPage+1);

    tapLeft.addEventListener('click',prev);
    tapRight.addEventListener('click',next);
    tapCenter.addEventListener('click',()=>{full.classList.toggle('reader-ui-hidden');setTimeout(()=>draw(currentPage),0)});

    pageArea.addEventListener('touchstart',e=>{
      if(!e.touches?.length)return;
      touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;
    },{passive:true});

    pageArea.addEventListener('touchend',e=>{
      if(touchStartX===null||!e.changedTouches?.length)return;
      const dx=e.changedTouches[0].clientX-touchStartX;
      const dy=e.changedTouches[0].clientY-touchStartY;
      touchStartX=null;touchStartY=null;
      if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy))return;
      dx<0?next():prev();
    },{passive:true});

    full.tabIndex=0;
    full.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')prev();if(e.key==='ArrowRight')next()});

    let rt=null;
    window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>draw(currentPage),120)});

    await draw(currentPage);
    full.focus({preventScroll:true});
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
