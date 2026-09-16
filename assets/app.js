
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
        <div class="pdf-stage" id="pdf-stage"><canvas id="pdf-canvas"></canvas></div>
        <button class="tap-zone tap-zone-left" id="tap-left" type="button" aria-label="Página anterior"></button>
        <div class="reader-center-zone" id="tap-center"></div>
        <button class="tap-zone tap-zone-right" id="tap-right" type="button" aria-label="Página siguiente"></button>
        <div class="page-turn-hint">Toca izquierda o derecha para pasar página</div><div class="zoom-badge" id="zoom-badge">100%</div>
      </div>
      <div class="reader-bottom">
        <div class="reader-bottom-row"><span id="page-label">Página — de —</span><span id="percent-label">0% leído</span></div>
        <div class="reader-progress"><div id="reader-progress-fill"></div></div>
      </div>
    </div>`;

  const full=document.getElementById('reader-fullscreen');
  const pageArea=document.getElementById('reader-page-area');
  const stage=document.getElementById('pdf-stage');
  const canvas=document.getElementById('pdf-canvas');
  const ctx=canvas.getContext('2d');
  const tapLeft=document.getElementById('tap-left'),tapRight=document.getElementById('tap-right');
  const tapCenter=document.getElementById('tap-center');
  const pageLabel=document.getElementById('page-label');
  const topPageLabel=document.getElementById('top-page-label');
  const percentLabel=document.getElementById('percent-label');
  const progressFill=document.getElementById('reader-progress-fill');
  const zoomBadge=document.getElementById('zoom-badge');

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

    let zoom=1;
    let panX=0;
    let panY=0;
    let pinchStartDistance=0;
    let pinchStartZoom=1;
    let panStartX=0;
    let panStartY=0;
    let panOriginX=0;
    let panOriginY=0;
    let lastTapTime=0;

    function distanceBetween(t1,t2){
      const dx=t2.clientX-t1.clientX;
      const dy=t2.clientY-t1.clientY;
      return Math.hypot(dx,dy);
    }

    function clampZoom(value){
      return Math.max(1,Math.min(4,value));
    }

    function applyTransform(){
      stage.style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;
      zoomBadge.textContent=`${Math.round(zoom*100)}%`;
      full.classList.toggle('zoomed',zoom>1.01);
    }

    function clampPan(){
      if(zoom<=1.01){
        panX=0;
        panY=0;
        return;
      }

      const scaledW=stage.clientWidth*zoom;
      const scaledH=stage.clientHeight*zoom;
      const maxX=Math.max(0,(scaledW-pageArea.clientWidth)/2);
      const maxY=Math.max(0,(scaledH-pageArea.clientHeight)/2);

      panX=Math.max(-maxX,Math.min(maxX,panX));
      panY=Math.max(-maxY,Math.min(maxY,panY));
    }

    function resetZoom(){
      zoom=1;
      panX=0;
      panY=0;
      applyTransform();
    }

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
        stage.style.width=`${Math.floor(viewport.width)}px`;
        stage.style.height=`${Math.floor(viewport.height)}px`;
        await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
        currentPage=pageNum;

        // El zoom pertenece al lector, no a una página concreta.
        // Al cambiar de hoja conservamos exactamente el mismo zoom.
        clampPan();
        applyTransform();

        // Algunos WebViews de Telegram recalculan estilos al cambiar el bitmap
        // del canvas. Reaplicamos el transform en el siguiente frame.
        requestAnimationFrame(() => {
          clampPan();
          applyTransform();
        });

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
// Evita que el WebView amplíe toda la interfaz.
    ['gesturestart','gesturechange','gestureend'].forEach(name=>{
      document.addEventListener(name,e=>e.preventDefault(),{passive:false});
    });

    let gestureMoved=false;
    let touchStartedAt=0;
    let singleStartX=null;
    let singleStartY=null;

    pageArea.addEventListener('touchstart',e=>{
      if(e.target.closest?.('.tap-zone')) return;

      touchStartedAt=Date.now();
      gestureMoved=false;

      if(e.touches.length===2){
        e.preventDefault();
        pinchStartDistance=distanceBetween(e.touches[0],e.touches[1]);
        pinchStartZoom=zoom;
        return;
      }

      if(e.touches.length!==1)return;

      const t=e.touches[0];
      singleStartX=t.clientX;
      singleStartY=t.clientY;

      if(zoom>1.01){
        e.preventDefault();
        panStartX=t.clientX;
        panStartY=t.clientY;
        panOriginX=panX;
        panOriginY=panY;
      }else{
        touchStartX=t.clientX;
        touchStartY=t.clientY;
      }
    },{passive:false});

    pageArea.addEventListener('touchmove',e=>{
      if(e.target.closest?.('.tap-zone')) return;

      if(e.touches.length===2){
        e.preventDefault();
        gestureMoved=true;

        const d=distanceBetween(e.touches[0],e.touches[1]);

        if(pinchStartDistance>0){
          zoom=clampZoom(pinchStartZoom*(d/pinchStartDistance));

          if(zoom<=1.01){
            zoom=1;
            panX=0;
            panY=0;
          }

          applyTransform();
        }

        return;
      }

      if(e.touches.length===1 && zoom>1.01){
        e.preventDefault();

        const t=e.touches[0];
        const dx=t.clientX-panStartX;
        const dy=t.clientY-panStartY;

        if(Math.abs(dx)>4 || Math.abs(dy)>4){
          gestureMoved=true;
        }

        panX=panOriginX+dx;
        panY=panOriginY+dy;
        clampPan();
        applyTransform();
      }
    },{passive:false});

    pageArea.addEventListener('touchend',e=>{
      if(e.target.closest?.('.tap-zone')) return;

      if(e.touches.length===0){
        pinchStartDistance=0;
      }

      if(!e.changedTouches?.length)return;

      const t=e.changedTouches[0];
      const endX=t.clientX;
      const endY=t.clientY;
      const width=pageArea.clientWidth;
      const elapsed=Date.now()-touchStartedAt;

      const dx=(singleStartX===null)?0:endX-singleStartX;
      const dy=(singleStartY===null)?0:endY-singleStartY;
      const wasTap=!gestureMoved && Math.abs(dx)<14 && Math.abs(dy)<14 && elapsed<500;

      // Doble toque: 2x / volver a 100%.
      if(wasTap){
        const now=Date.now();

        if(now-lastTapTime<300){
          if(zoom>1.01){
            resetZoom();
          }else{
            zoom=2;
            panX=0;
            panY=0;
            applyTransform();
          }

          lastTapTime=0;
          singleStartX=null;
          singleStartY=null;
          touchStartX=null;
          touchStartY=null;
          return;
        }

        lastTapTime=now;

        // Un toque en el 40% izquierdo/derecho pasa página,
        // incluso cuando el PDF está ampliado.
        if(endX < width*0.40){
          prev();
        }else if(endX > width*0.60){
          next();
        }else if(zoom<=1.01){
          full.classList.toggle('reader-ui-hidden');
          setTimeout(()=>draw(currentPage),0);
        }

        singleStartX=null;
        singleStartY=null;
        touchStartX=null;
        touchStartY=null;
        return;
      }

      // Swipe para pasar página solo a 100%, para no interferir con el pan.
      if(zoom<=1.01 && Math.abs(dx)>=45 && Math.abs(dx)>Math.abs(dy)){
        dx<0 ? next() : prev();
      }

      singleStartX=null;
      singleStartY=null;
      touchStartX=null;
      touchStartY=null;
    },{passive:false});

    // Click/tap de las zonas transparentes: útil en Android y en PC.


    // Doble clic en PC/tablet.
    stage.addEventListener('dblclick',e=>{
      e.preventDefault();
      if(zoom>1.01) resetZoom();
      else{
        zoom=2;
        panX=0;
        panY=0;
        applyTransform();
      }
    });
    // ------------------------------------------------------------
    // Cambio de página con Pointer Events.
    // Esto evita el conflicto entre pinch-zoom y touchend/click
    // dentro del WebView móvil de Telegram.
    // ------------------------------------------------------------
    function bindPageEdge(zone, direction){
      let activePointerId = null;
      let startX = 0;
      let startY = 0;
      let moved = false;

      zone.addEventListener('pointerdown', e => {
        // Ignorar contactos múltiples en la banda lateral.
        if(activePointerId !== null) return;

        activePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        moved = false;

        try {
          zone.setPointerCapture(e.pointerId);
        } catch (_) {}

        e.preventDefault();
        e.stopPropagation();
      });

      zone.addEventListener('pointermove', e => {
        if(e.pointerId !== activePointerId) return;

        if(
          Math.abs(e.clientX - startX) > 12 ||
          Math.abs(e.clientY - startY) > 12
        ){
          moved = true;
        }

        e.preventDefault();
        e.stopPropagation();
      });

      zone.addEventListener('pointerup', e => {
        if(e.pointerId !== activePointerId) return;

        try {
          zone.releasePointerCapture(e.pointerId);
        } catch (_) {}

        const wasTap = !moved;

        activePointerId = null;

        e.preventDefault();
        e.stopPropagation();

        if(!wasTap) return;

        if(direction === 'prev') prev();
        else next();
      });

      zone.addEventListener('pointercancel', e => {
        if(e.pointerId !== activePointerId) return;
        activePointerId = null;
      });
    }

    bindPageEdge(tapLeft, 'prev');
    bindPageEdge(tapRight, 'next');

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
