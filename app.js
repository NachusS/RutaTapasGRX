/* RutaTapasGRX - app.js (multi-ruta, robust JSON loader) */
(() => {
  const LS_KEYS = { progress:'tapas_progress', theme:'tapas_theme', nextStop:'tapas_nextStopId', metrics:'tapas_metrics', route:'tapas_route_path' };

  // --- Utilidades ---
  async function loadJSONSafe(url){
    const res = await fetch(url, { cache:'no-cache' });
    if(!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
    const raw = await res.text();
    // Intento 1: parse directo
    try { return JSON.parse(raw); } catch(e1){
      // Intento 2: saneo de tokens inválidos (NaN/Infinity) y BOM
      const cleaned = raw
        .replace(/^\uFEFF/, '')             // quita BOM
        .replace(/\bNaN\b/gi, 'null')       // JSON no admite NaN
        .replace(/\bInfinity\b/gi, 'null')  // por si acaso
        .replace(/\b-?Inf\b/gi, 'null');
      try { return JSON.parse(cleaned); } catch(e2){
        console.error('Fallo al parsear JSON de', url, e2, { rawSnippet: raw.slice(0, 200) });
        throw e2;
      }
    }
  }

  function coerceStop(s){
    const num = v => (typeof v === 'number' ? v : Number(v));
    return {
      ...s,
      id: String(s.id || '').trim(),
      name: String(s.name || '').trim(),
      address: typeof s.address === 'string' ? s.address : '',
      tapa: String(s.tapa || '').trim(),
      photo: String(s.photo || '').trim(),
      notes: typeof s.notes === 'string' ? s.notes : '',
      lat: num(s.lat),
      lng: num(s.lng),
      order: Number(s.order || 0)
    };
  }

  const App = {
    map:null, directionsService:null, directionsRenderer:null,
    userMarker:null, userAccuracyCircle:null, watchId:null,
    data:null, markers:new Map(), polyline:null, currentDestinationId:null,
    metrics:{ opens:0, clicksNext:0, geoErrors:0 },
    routeList:[], currentRoutePath:'data/stops.json',

    async init(){
      // Aviso si se abre como file:// (fetch y geolocalización pueden fallar)
      if (location.protocol === 'file:') {
        alert('Estás abriendo la app como "file://". Usa HTTPS (GitHub Pages) o un servidor local para que funcione fetch/geolocalización.');
      }
      this.restoreTheme(); this.restoreMetrics();
      await this.loadRoutesList();
      await this.loadStops(this.currentRoutePath);
      this.buildUI();
      this.updateProgressUI();
      window.App=this;
    },

    async loadRoutesList(){
      try{
        const json = await loadJSONSafe('data/routes.json');
        this.routeList = json.routes || [];
      }catch(e){
        console.warn('No se pudo cargar routes.json, usando valor por defecto.', e);
        this.routeList = [{ id:'ruta_grx_v1', title:'RutaTapasGRX (por defecto)', file:'data/stops.json' }];
      }
      const saved = localStorage.getItem(LS_KEYS.route);
      const found = this.routeList.find(r => r.file === saved);
      this.currentRoutePath = found ? found.file : (this.routeList[0]?.file || 'data/stops.json');
      const sel = document.getElementById('routeSelect');
      if(sel){
        sel.innerHTML = this.routeList.map(r => `<option value="${r.file}">${r.title}</option>`).join('');
        sel.value = this.currentRoutePath;
        sel.addEventListener('change', async (e)=>{
          const path = e.target.value;
          localStorage.setItem(LS_KEYS.route, path);
          await this.switchRoute(path);
        });
      }
    },

    async switchRoute(path){
      localStorage.removeItem(LS_KEYS.nextStop);
      localStorage.removeItem(LS_KEYS.progress);
      this.currentDestinationId = null;
      this.clearMapArtifacts();
      await this.loadStops(path);
      this.buildUI();
      this.updateProgressUI();
      if(this.map){
        this.drawMarkers();
        this.drawPolylineFallback();
      } else {
        this.initMap();
      }
    },

    clearMapArtifacts(){
      if(this.directionsRenderer){ try{ this.directionsRenderer.set('directions', null); }catch{} }
      if(this.polyline){ try{ this.polyline.setMap(null); }catch{} this.polyline=null; }
      if(this.markers && this.markers.size){
        for(const m of this.markers.values()){ try{ m.setMap(null); }catch{} }
        this.markers = new Map();
      }
      const list = document.getElementById('stopsList');
      if(list) list.innerHTML='';
    },

    async loadStops(path='data/stops.json'){
      try{
        const json = await loadJSONSafe(path);
        json.stops = (json.stops||[]).map(coerceStop).sort((a,b)=>(a.order||0)-(b.order||0));
        this.data=json;
        document.title=json.meta?.title||document.title;
        const titleEl=document.getElementById('appTitle'); if(titleEl) titleEl.textContent=json.meta?.title||'RutaTapasGRX';
      }catch(e){
        console.error('No se pudieron cargar las paradas:', e);
        alert('No se pudieron cargar las paradas. Revisa que el JSON sea válido (sin NaN) y que la app se sirva por HTTPS.');
        // Deja un estado mínimo para evitar fallos en otros métodos
        this.data = { meta:{}, stops: [] };
      }
    },

    initMap(){
      if(!this.data) return;
      const center = { lat:this.data.meta?.start?.lat||37.176, lng:this.data.meta?.start?.lng||-3.598 };
      this.map=new google.maps.Map(document.getElementById('map'), {center, zoom:15, mapTypeControl:false, fullscreenControl:true, streetViewControl:false});
      this.directionsService=new google.maps.DirectionsService();
      this.directionsRenderer=new google.maps.DirectionsRenderer({suppressMarkers:true, polylineOptions:{strokeWeight:5}});
      this.directionsRenderer.setMap(this.map);
      this.drawMarkers();
      this.drawPolylineFallback();
      this.setupGeolocation();
      this.restoreNextStop();
    },

    drawMarkers(){
      const start=this.data.meta?.start, end=this.data.meta?.end, stops=this.data.stops, info=new google.maps.InfoWindow();
      if(start && Number.isFinite(start.lat) && Number.isFinite(start.lng)){
        const m=new google.maps.Marker({position:{lat:start.lat,lng:start.lng}, map:this.map, title:`Inicio: ${start.name||'Inicio'}`, icon:this.flagIcon('#10b981')}); this.markers.set('START',m);
      }
      if(end && Number.isFinite(end.lat) && Number.isFinite(end.lng)){
        const m=new google.maps.Marker({position:{lat:end.lat,lng:end.lng}, map:this.map, title:`Fin: ${end.name||'Fin'}`, icon:this.flagIcon('#f59e0b')}); this.markers.set('END',m);
      }
      (stops||[]).forEach(s=>{
        if(!Number.isFinite(s.lat)||!Number.isFinite(s.lng)) return;
        const m=new google.maps.Marker({position:{lat:s.lat,lng:s.lng}, map:this.map, title:`${s.order}. ${s.name}`, label:{text:String(s.order), fontSize:'12px', fontWeight:'700'}});
        m.addListener('click',()=>{ info.setContent(this.stopInfoHTML(s)); info.open(this.map,m); this.focusCard(s.id); });
        this.markers.set(s.id,m);
      });
    },

    flagIcon(color){ const svg=encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2'><path d='M4 2v20'/><path fill='${color}' d='M4 3h11l-2 3 2 3H4z'/></svg>`); return {url:`data:image/svg+xml;charset=UTF-8,${svg}`, scaledSize:new google.maps.Size(28,28), anchor:new google.maps.Point(6,26)}; },

    stopInfoHTML(s){
      const addr=s.address?`<div class="meta">${s.address}</div>`:''; const foto=s.photo?s.photo:'assets/cover.jpg'; const done=this.isDone(s.id);
      return `<div class="infobox"><div style="display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:start">
        <img src="${foto}" alt="Foto de ${this.escape(s.name)}" width="110" height="80" style="border-radius:8px;object-fit:cover" />
        <div><strong>${s.order}. ${this.escape(s.name)}</strong>${addr}<div class="meta">Tapa: ${this.escape(s.tapa||'—')}</div>
          <div class="actions" style="margin-top:6px"><button class="btn ${done?'':'primary'}" data-action="toggle" data-id="${s.id}">${done?'Desmarcar':'Marcar como hecha'}</button>
          <button class="btn" data-action="goto" data-id="${s.id}">Ir a esta parada</button></div></div></div></div>`;
    },

    drawPolylineFallback(){
      const path=(this.data.stops||[]).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)).map(s=>({lat:s.lat,lng:s.lng}));
      if(this.polyline) this.polyline.setMap(null);
      if(!path.length) return;
      this.polyline=new google.maps.Polyline({path, geodesic:true, strokeColor:'#2563eb', strokeOpacity:.6, strokeWeight:4});
      this.polyline.setMap(this.map);
    },

    async routeTo(stopId){
      const dest=(this.data.stops||[]).find(s=>s.id===stopId)||null; if(!dest) return;
      this.currentDestinationId=stopId; localStorage.setItem(LS_KEYS.nextStop, stopId);
      let origin=null;
      if(this.userMarker) origin=this.userMarker.getPosition();
      if(!origin){
        const idx=(this.data.stops||[]).findIndex(s=>s.id===stopId);
        origin= idx>0 ? {lat:this.data.stops[idx-1].lat,lng:this.data.stops[idx-1].lng} : {lat:this.data.meta?.start?.lat||dest.lat, lng:this.data.meta?.start?.lng||dest.lng};
      }
      try{
        const res=await this.directionsService.route({origin, destination:{lat:dest.lat,lng:dest.lng}, travelMode:google.maps.TravelMode.WALKING});
        this.directionsRenderer.setDirections(res);
        const leg=res.routes[0].legs[0]; this.map.fitBounds(res.routes[0].bounds);
        this.announce(`Direcciones hacia ${dest.name}. Distancia ${leg.distance?.text||'—'}, tiempo estimado ${leg.duration?.text||'—'}.`);
      }catch(e){ console.warn('Directions fallo', e); this.map.panTo({lat:dest.lat,lng:dest.lng}); this.map.setZoom(16); this.announce('No se pudo calcular la ruta con Directions.'); }
    },

    buildUI(){
      const list=document.getElementById('stopsList'); if(!list) return; list.innerHTML=''; const stops=this.data.stops||[];
      stops.forEach(s=>{
        const li=document.createElement('li'); li.className='card'; li.id=`card-${s.id}`;
        li.innerHTML=`<img src="${s.photo||'assets/cover.jpg'}" alt="Foto de ${this.escape(s.name)}"><div>
          <h3>${s.order}. ${this.escape(s.name)}</h3>
          <div class="meta">${s.address?this.escape(s.address):''}</div>
          <div class="meta">Tapa: ${this.escape(s.tapa||'—')}</div>
          <div class="actions">
            <button class="btn ${this.isDone(s.id)?'':'primary'}" data-action="toggle" data-id="${s.id}" aria-pressed="${this.isDone(s.id)}">${this.isDone(s.id)?'Desmarcar':'Marcar como hecha'}</button>
            <button class="btn" data-action="goto" data-id="${s.id}">Ir a esta parada</button>
          </div>
        </div>`;
        list.appendChild(li);
      });

      document.body.addEventListener('click', e=>{
        const btn=e.target.closest('button[data-action]'); if(!btn) return;
        const id=btn.getAttribute('data-id'); const action=btn.getAttribute('data-action');
        if(action==='toggle') this.toggleDone(id);
        if(action==='goto') this.routeTo(id);
      });

      const startBtn=document.getElementById('startBtn');
      if(startBtn) startBtn.addEventListener('click', ()=>{
        const first=this.firstPending()||(this.data.stops?.[0]?.id); if(first) this.routeTo(first);
      });
      const nextBtn=document.getElementById('nextBtn');
      if(nextBtn) nextBtn.addEventListener('click', ()=>{
        this.metrics.clicksNext++; this.persistMetrics();
        const next=this.nextStop(); if(next) this.routeTo(next.id);
      });
      const resetBtn=document.getElementById('resetBtn');
      if(resetBtn) resetBtn.addEventListener('click', ()=>{
        if(confirm('¿Seguro que quieres reiniciar el checklist?')){
          localStorage.removeItem(LS_KEYS.progress); localStorage.removeItem(LS_KEYS.nextStop);
          this.refreshCards(); this.updateProgressUI(); this.announce('Checklist reiniciado.');
        }
      });
      const themeBtn=document.getElementById('themeBtn');
      if(themeBtn) themeBtn.addEventListener('click', ()=>{
        const html=document.documentElement; const now=html.getAttribute('data-theme')==='dark'?'light':'dark';
        html.setAttribute('data-theme', now); localStorage.setItem(LS_KEYS.theme, now);
        themeBtn.setAttribute('aria-pressed', String(now==='dark'));
      });
    },

    escape(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    toggleDone(id){ const p=this.readProgress(); p[id]=!p[id]; localStorage.setItem(LS_KEYS.progress, JSON.stringify(p)); this.refreshCards(); this.updateProgressUI(); if(p[id]&&this.currentDestinationId===id){ const n=this.nextStop(); if(n) this.announce(`¡Bien! Avanza a ${n.name}.`);} },
    refreshCards(){ (this.data.stops||[]).forEach(s=>{ const card=document.getElementById(`card-${s.id}`); if(!card) return; const btn=card.querySelector('button[data-action="toggle"]'); const done=this.isDone(s.id); btn.textContent=done?'Desmarcar':'Marcar como hecha'; btn.classList.toggle('primary', !done); btn.setAttribute('aria-pressed', String(done)); card.style.opacity=done?.65:1; }); },
    isDone(id){ const p=this.readProgress(); return !!p[id]; },
    readProgress(){ try{ return JSON.parse(localStorage.getItem(LS_KEYS.progress)||'{}'); }catch{ return {}; } },
    firstPending(){ return (this.data.stops||[]).find(s=>!this.isDone(s.id))?.id||null; },
    nextStop(){ const stops=this.data.stops||[]; const idx=this.currentDestinationId?stops.findIndex(s=>s.id===this.currentDestinationId):-1; const list=idx>=0?stops.slice(idx+1).concat(stops.slice(0,idx+1)):stops; const next=list.find(s=>!this.isDone(s.id)); return next||stops[stops.length-1]||null; },
    updateProgressUI(){ const total=this.data?.stops?.length||0; const done=(this.data.stops||[]).filter(s=>this.isDone(s.id)).length; const pct=total?Math.round(done/total*100):0; const txt=document.getElementById('progressText'); if(txt) txt.textContent=`Completadas ${done} / ${total}`; const bar=document.getElementById('progressBarFill'); if(bar) bar.style.width=`${pct}%`; },
    focusCard(id){ const el=document.getElementById(`card-${id}`); if(!el) return; el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('focus-pulse'); setTimeout(()=>el.classList.remove('focus-pulse'),700); },

    setupGeolocation(){
      if(!('geolocation' in navigator)){ alert('Geolocalización no disponible.'); return; }
      this.watchId=navigator.geolocation.watchPosition(
        pos=>{
          const {latitude, longitude, accuracy}=pos.coords; const latLng={lat:latitude,lng:longitude};
          if(!this.userMarker){
            this.userMarker=new google.maps.Marker({position:latLng, map:this.map, title:'Tu posición', icon:{path:google.maps.SymbolPath.CIRCLE, scale:6, fillColor:'#ef4444', fillOpacity:1, strokeWeight:2}});
            this.userAccuracyCircle=new google.maps.Circle({strokeColor:'#ef4444', strokeOpacity:.3, strokeWeight:1, fillColor:'#ef4444', fillOpacity:.08, map:this.map, center:latLng, radius:accuracy});
          }else{
            this.userMarker.setPosition(latLng); if(this.userAccuracyCircle){ this.userAccuracyCircle.setCenter(latLng); this.userAccuracyCircle.setRadius(accuracy); }
          }
        },
        err=>{ this.metrics.geoErrors++; this.persistMetrics(); console.warn('Geo error', err); this.announce('Geolocalización no disponible o permiso denegado.'); },
        { enableHighAccuracy:true, maximumAge:10000, timeout:20000 }
      );
    },

    restoreTheme(){ const saved=localStorage.getItem(LS_KEYS.theme); const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches; const theme=saved||(prefersDark?'dark':'light'); document.documentElement.setAttribute('data-theme', theme); const btn=document.getElementById('themeBtn'); if(btn) btn.setAttribute('aria-pressed', String(theme==='dark')); },
    restoreNextStop(){ const saved=localStorage.getItem(LS_KEYS.nextStop); if(saved) this.currentDestinationId=saved; },
    announce(t){ const live=document.querySelector('.progress-wrap'); if(!live) return; const temp=document.createElement('div'); temp.className='sr-only'; temp.textContent=t; live.appendChild(temp); setTimeout(()=>temp.remove(),1200); },
    persistMetrics(){ localStorage.setItem(LS_KEYS.metrics, JSON.stringify(this.metrics)); },
    restoreMetrics(){ try{ const m=JSON.parse(localStorage.getItem(LS_KEYS.metrics)||'{}'); this.metrics={ opens:(m.opens||0)+1, clicksNext:m.clicksNext||0, geoErrors:m.geoErrors||0 }; this.persistMetrics(); }catch{ this.metrics={opens:1, clicksNext:0, geoErrors:0}; this.persistMetrics(); } }
  };

  App.init(); window.App=App;
})();
