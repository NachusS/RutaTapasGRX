
// === v6.5.1-b: tolerant web field resolver ===
function getStopWeb(s){
  if(!s || typeof s !== 'object') return null;
  const candidates = ['web', 'website', 'url', 'Web', 'WEB', 'web:', 'pagina', 'page', 'link'];
  for(const k of candidates){
    if(Object.prototype.hasOwnProperty.call(s, k)){
      const v = s[k];
      if(typeof v === 'string' && v.trim().length){ return v.trim(); }
    }
  }
  return null;
}
/* RutaTapas · v6.3 — etiqueta móvil+desktop, rutas robustas, tracking, etc. */
const state = {
  map: null,
  directionsService: null,
  directionsRenderer: null,
  userMarker: null,
  userCircle: null,
  markers: new Map(),
  infoWindow: null,
  stops: [],
  routeMeta: null,
  currentTargetId: null,
  watchId: null,
  routePolylines: [],
  metrics: {
    opens: Number(localStorage.getItem("tapas_metric_opens")||0),
    nextClicks: Number(localStorage.getItem("tapas_metric_next")||0),
    geoErrors: Number(localStorage.getItem("tapas_metric_geoerr")||0),
  }
};

const LS_KEYS = { progress: "tapas_progress", theme: "tapas_theme", next: "tapas_nextStopId", showRoute: "tapas_showFullRoute" };
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || null; }

function loadJSON(url){
  const u = new URL(url, document.baseURI);
  u.searchParams.set('v', String(Date.now())); // cache-bust
  return fetch(u.toString(), {cache:"no-cache"}).then(r=>{
    if(!r.ok) throw new Error(`HTTP ${r.status} al cargar ${u}`);
    return r.json();
  });
}
function getProgress(){ try{ return JSON.parse(localStorage.getItem(LS_KEYS.progress) || "{}"); }catch{ return {}; } }
function setProgress(obj){ localStorage.setItem(LS_KEYS.progress, JSON.stringify(obj)); }
function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(LS_KEYS.theme, theme);
  $("#toggleThemeBtn")?.setAttribute("aria-pressed", theme === "dark");
  const c = cssVar('--brand') || '#2563eb';
  if(state.routePolylines){ state.routePolylines.forEach(pl=>pl.setOptions({strokeColor: c})); }
}
function toggleTheme(){ const now=document.documentElement.getAttribute("data-theme"); setTheme(now==="dark"?"light":"dark"); }
function minutesToHuman(min){ if(!Number.isFinite(min)) return "–"; const h=Math.floor(min/60); const m=Math.round(min%60); return h>0?`${h} h ${m} min`:`${m} min`; }

async function loadRoutesList(){
  const tries = [
    'data/routes.json',
    './data/routes.json',
    new URL('data/routes.json', document.baseURI).toString(),
    'routes.json'
  ];
  const errors = [];
  for(const t of tries){
    try{
      const json = await loadJSON(t);
      if(Array.isArray(json)) return { routes: json };
      if(json && Array.isArray(json.routes)) return json;
      errors.push(`Estructura inválida en ${t}`);
    }catch(e){
      errors.push(`${t}: ${e && (e.message||e)}`);
    }
  }
  showDiag('No se pudo cargar data/routes.json. Revisa ruta/estructura.');
  console.error('Fallos al cargar rutas:', errors);
  return { routes: [] };
}

window.initMap = async function initMap(){
  state.showFullRoute = (localStorage.getItem(LS_KEYS.showRoute) ?? '1') !== '0';
  setTheme(localStorage.getItem(LS_KEYS.theme) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light"));
  try{ localStorage.setItem("tapas_metric_opens", String(state.metrics.opens + 1)); }catch{}

  const routes = await loadRoutesList();
  const routeSelect = $("#routeSelect");
  if(routes.routes.length===0){
    routeSelect.innerHTML = '<option value="" disabled selected>(Sin rutas)</option>';
    state.map = new google.maps.Map($("#map"), { center:{lat:37.1765,lng:-3.5979}, zoom:14 });
  } else {
    routes.routes.forEach(r=>{ const opt=document.createElement("option"); opt.value=r.id || r.title; opt.textContent=r.name || r.title || r.id; routeSelect.appendChild(opt); });
    const defaultRouteId = routes.routes[0]?.id || routes.routes[0]?.title || "ruta_demo";
    const selectedId = localStorage.getItem("tapas_route") || defaultRouteId;
    routeSelect.value = selectedId;

    $("#toggleThemeBtn").addEventListener("click", toggleTheme);
    $("#resetChecklistBtn").addEventListener("click", resetChecklist);
    $("#startBtn").addEventListener("click", () => startNavigation());
    $("#nextBtn").addEventListener("click", () => { try{ localStorage.setItem("tapas_metric_next", String(state.metrics.nextClicks + 1)); }catch{}; goNext(); });
    routeSelect.addEventListener("change", async (e)=>{ const id=e.target.value; localStorage.setItem("tapas_route", id); await loadRouteById(routes, id); });

    state.map = new google.maps.Map($("#map"), { center:{lat:40.4168,lng:-3.7038}, zoom:14 });
    state.directionsService = new google.maps.DirectionsService();
    state.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers:true, preserveViewport:true });
    state.directionsRenderer.setMap(state.map);
    state.infoWindow = new google.maps.InfoWindow();
    state.map.addListener('click', ()=>{ if(state.infoWindow) state.infoWindow.close(); });

    await loadRouteById(routes, selectedId);
  }

  // Sync switches (desktop & mobile)
  const toggleFR = document.getElementById('toggleFullRoute');
  const toggleFRm = document.getElementById('toggleFullRouteMobile');
  const applyStateToSwitches = () => {
    if(toggleFR) toggleFR.checked = !!state.showFullRoute;
    if(toggleFRm) toggleFRm.checked = !!state.showFullRoute;
  };
  applyStateToSwitches();
  const onSwitchChange = (checked) => {
    state.showFullRoute = !!checked;
    localStorage.setItem(LS_KEYS.showRoute, state.showFullRoute ? '1' : '0');
    updateFullRouteVisibility();
    applyStateToSwitches();
  };
  if(toggleFR){ toggleFR.addEventListener('change', ()=> onSwitchChange(toggleFR.checked)); }
  if(toggleFRm){ toggleFRm.addEventListener('change', ()=> onSwitchChange(toggleFRm.checked)); }

  setupGeolocation();
};

async function loadRouteById(routes, id){
  const meta = routes.routes.find(r=>r.id===id || r.title===id) || routes.routes[0];
  state.routeMeta = meta;
  $("#routeLabel").textContent = (meta?.name || meta?.title || "Ruta");

  const filePath = (meta.file||'data/stops.json');
  const finalPath = filePath.startsWith('data/') ? filePath : `data/${filePath}`;
  const data = await loadJSON(finalPath);
  state.lastLoadedMeta = data;
  const stops = (data.stops||[]).slice().sort((a,b)=> (a.order||0)-(b.order||0)).map((s,i)=>{
    if(!s.id) s.id = (s.name||`stop_${i+1}`).toLowerCase().replace(/\\W+/g,'_');
    return s;
  });
  state.stops = stops;
  buildMap(stops, meta);
  await buildFullRoutePolyline();
  buildList(stops);
  restoreProgressUI();
  updateETA();
}

function buildMap(stops, meta){
  state.markers.forEach(m=>m.setMap(null));
  state.markers.clear();

  let center = null;
  if(state.lastLoadedMeta && state.lastLoadedMeta.meta && state.lastLoadedMeta.meta.start){
    const s = state.lastLoadedMeta.meta.start; center = {lat: s.lat, lng: s.lng};
  }else if(stops && stops.length){
    center = {lat:stops[0].lat, lng:stops[0].lng};
  }else if(meta && meta.cityCenter){
    center = meta.cityCenter;
  }
  if(center) state.map.setCenter(center);

  for(const s of stops){
    const marker = new google.maps.Marker({
      position: {lat:s.lat,lng:s.lng},
      map: state.map,
      icon: (s.order===1 || s.order===stops.length) ? "https://maps.gstatic.com/mapfiles/ms2/micons/flag.png" : undefined,
      title: `${s.order}. ${s.name}`
    });
    marker.addListener("click", ()=>{
      if(state.infoWindow){ state.infoWindow.close(); }
      const html = `<div style="font:600 14px system-ui, -apple-system, Segoe UI, Roboto; color:#111; line-height:1.35;">
        ${s.order}. ${s.name}<br><span style="font:400 12px system-ui; color:#333;">${s.address||""}</span>
      </div>`;
      state.infoWindow.setContent(html);
      state.infoWindow.open({anchor:marker, map: state.map, shouldFocus:true});
      goTo(s.id);
    });
    state.markers.set(s.id, marker);
  }

  const path = stops.map(s=>({lat:s.lat, lng:s.lng}));
  state.poly && state.poly.setMap(null);
  state.poly = new google.maps.Polyline({ path, geodesic:false, strokeOpacity:0.0, map: state.map });

  if(path.length){
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p=>bounds.extend(p));
    try{ state.map.fitBounds(bounds); }catch{}
  }
}


function buildList(stops){
  const panel = $("#panel"); panel.innerHTML="";
  const progress = getProgress();
  for(const s of stops){
    const card = document.createElement("article");
    card.className = "card card-3d"; card.setAttribute("tabindex","0");
    const ratingVal = getRating(s.id);
    const webValue = getStopWeb(s);
    const hasWeb = !!(webValue && String(webValue).trim().length>0);
    const webHTML = hasWeb ? buildWebsiteHTML(s.name, webValue) : "";
    card.innerHTML = `
      <div class="card-visual">
        <img src="${s.photo || `assets/${s.id||'placeholder'}.jpg`}" alt="Foto de ${s.name}">
        <div class="card-glow" aria-hidden="true"></div>
      </div>
      <div class="card-body">
        <header class="card-head">
          <h3>${s.order? (s.order + '. ') : ''}${s.name}</h3>
          <div class="head-actions">${webHTML}</div>
        </header>
        <p class="tapa">${s.tapa?`Tapa típica: ${s.tapa}`:''}</p>
        <p class="addr">${s.address||''}</p>

        <div class="rating" role="radiogroup" aria-label="Valoración" data-id="${s.id}" data-value="${ratingVal}">
          ${[1,2,3,4,5].map(i=>`
            <button type="button" class="star" role="radio" aria-label="${i} estrella${i>1?'s':''}" aria-checked="${i===ratingVal}" data-value="${i}">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.3l2.7 6 6.5.5-4.9 4.2 1.5 6.4L12 16.9 6.2 19.4l1.5-6.4-4.9-4.2 6.5-.5L12 2.3z"/></svg>
            </button>
          `).join("")}
        </div>

        <div class="actions">
          <button type="button" class="btn" data-act="toggle" data-id="${s.id}" aria-pressed="${!!progress[s.id]}">${progress[s.id]?'Desmarcar':'Marcar como hecha'}</button>
          <button type="button" class="btn" data-act="goto" data-id="${s.id}">Ir a esta parada</button>
        </div>
      </div>
    `;
    panel.appendChild(card);
  }

  // buttons actions
  panel.addEventListener("click", (e)=>{
    const star=e.target.closest(".rating .star");
    if(star){
      const group = star.closest(".rating");
      const id = group.dataset.id;
      const value = Number(star.dataset.value)||0;
      setRating(id, value);
      return;
    }
    const btn=e.target.closest("button[data-act]"); if(!btn) return;
    e.stopPropagation();
    const id=btn.getAttribute("data-id"); const act=btn.getAttribute("data-act");
    if(act==="toggle") toggleDone(id);
    if(act==="goto") goTo(id);
  });

  // keyboard for rating (arrow keys)
  panel.addEventListener("keydown",(e)=>{
    if(e.target.closest(".rating")){
      const group = e.target.closest(".rating");
      const id = group.dataset.id;
      let val = getRating(id);
      if(e.key==="ArrowRight"||e.key==="ArrowUp"){ val = Math.min(5, val+1); setRating(id,val); e.preventDefault(); }
      if(e.key==="ArrowLeft"||e.key==="ArrowDown"){ val = Math.max(0, val-1); setRating(id,val); e.preventDefault(); }
    } else if((e.key==="Enter"||e.key===" ") && e.target.matches(".card")){
      const idx=Array.from(panel.children).indexOf(e.target); const s=state.stops[idx]; if(s) goTo(s.id);
    }
  });

  // initialize stars fill
  $$(".rating").forEach(g=> updateRatingGroupUI(g, Number(g.dataset.value)||0 ));
}



// --- Ratings (1–5 stars) with LocalStorage persistence ---
const RATING_PREFIX = "tapas_rating"; // localStorage key prefix
function ratingKey(routeId, stopId){ return `${RATING_PREFIX}:${routeId||'default'}:${stopId}`; }
function getRating(stopId){
  try{ return Number(localStorage.getItem(ratingKey(state?.routeMeta?.id, stopId)) || 0) || 0; }catch{return 0;}
}
function setRating(stopId, value){
  const v = Math.max(0, Math.min(5, Number(value)||0));
  try{ localStorage.setItem(ratingKey(state?.routeMeta?.id, stopId), String(v)); }catch{}
  // update UI
  const rg = document.querySelector(`.rating[data-id="${CSS.escape(stopId)}"]`);
  if(rg){ updateRatingGroupUI(rg, v); }
}
function updateRatingGroupUI(group, value){
  group.setAttribute("data-value", String(value));
  const stars = group.querySelectorAll('[role="radio"]');
  stars.forEach((btn, i)=>{
    const selected = (i+1)<=value;
    btn.setAttribute("aria-checked", String((i+1)===value));
    btn.dataset.filled = selected ? "1" : "0";
  });
}

function restoreProgressUI(){
  const progress = getProgress();
  $$("#panel button[data-act='toggle']").forEach(btn=>{
    const id = btn.getAttribute("data-id");
    const done = !!progress[id];
    btn.textContent = done? "Desmarcar":"Marcar como hecha";
    btn.setAttribute("aria-pressed", String(done));
    const card = btn.closest(".card"); if(card){ card.style.opacity = done ? .6 : 1; }
  });
  const total = state.stops.length;
  const doneCount = state.stops.filter(s => progress[s.id]).length;
  $("#progressText").textContent = `${doneCount} / ${total}`;
  const pct = total ? Math.round(doneCount/total*100) : 0;
  $("#progressFill").style.width = `${pct}%`;
  $(".progress-bar").setAttribute("aria-valuenow", String(pct));
  updateETA();
}

function resetChecklist(){ if(!confirm("¿Seguro que quieres reiniciar el progreso?")) return; localStorage.removeItem(LS_KEYS.progress); localStorage.removeItem(LS_KEYS.next); restoreProgressUI(); }
function toggleDone(id){ const progress=getProgress(); progress[id]=!progress[id]; setProgress(progress); const target=getNextStopId(progress); localStorage.setItem(LS_KEYS.next, target || ""); restoreProgressUI(); }
function getNextStopId(progress=getProgress()){ for(const s of state.stops){ if(!progress[s.id]) return s.id; } return null; }
function goNext(){ const progress=getProgress(); const target=getNextStopId(progress) || state.stops[state.stops.length-1]?.id; localStorage.setItem(LS_KEYS.next, target || ""); if(target) goTo(target); }
function goTo(id){
  const stop = state.stops.find(s=>s.id===id); if(!stop) return;
  state.currentTargetId = id; localStorage.setItem(LS_KEYS.next, id);
  const mk = state.markers.get(id);
  if(mk){
    state.map.panTo(mk.getPosition()); state.map.setZoom(16);
    if(state.infoWindow){ state.infoWindow.close(); }
    const html = `<div style="font:600 14px system-ui; color:#111; line-height:1.35;">${stop.order? stop.order+'. ' : ''}${stop.name}</div>`;
    state.infoWindow.setContent(html);
    state.infoWindow.open({anchor: mk, map: state.map, shouldFocus: true});
  }
  startNavigation();
}

function startNavigation(){
  const nextId = localStorage.getItem(LS_KEYS.next) || getNextStopId() || state.stops[0]?.id; if(!nextId) return;
  const dest = state.stops.find(s=>s.id===nextId);
  let origin=null;
  if(state.userMarker){ origin = state.userMarker.getPosition(); }
  else{ const idx=state.stops.findIndex(s=>s.id===nextId); origin = idx>0 ? {lat: state.stops[idx-1].lat, lng: state.stops[idx-1].lng} : {lat: state.stops[0].lat, lng: state.stops[0].lng}; }

  state.directionsService.route({ origin, destination:{lat:dest.lat,lng:dest.lng}, travelMode: google.maps.TravelMode.WALKING },
  (result, status)=>{
    if(status === "OK"){
      state.directionsRenderer.setDirections(result);
      const leg = result.routes?.[0]?.legs?.[0];
      const mins = leg ? (leg.duration?.value||0)/60 : null;
      $("#etaTotal").textContent = minutesToHuman(mins);
      updateETA();
      if(state.poly) state.poly.setOptions({strokeOpacity: 0.0});
    }else{
      console.warn("Directions falló:", status);
      if(state.poly){ state.poly.setOptions({strokeOpacity: 0.8, strokeWeight: 4}); }
    }
  });
}

function updateETA(){
  const progress=getProgress(); const totalStops=state.stops.length; const done=state.stops.filter(s=>progress[s.id]).length;
  const totalMinutes=Math.max(0,(totalStops-1)*8); const doneMinutes=Math.max(0,Math.min(done,totalStops-1)*8);
  $("#etaTotal").textContent = minutesToHuman(totalMinutes);
  $("#etaDone").textContent = minutesToHuman(doneMinutes);
}

/** Ruta completa (chunked) sobre TODAS las paradas */
async function buildFullRoutePolyline(){
  if(state.routePolylines){ state.routePolylines.forEach(pl=>pl.setMap(null)); }
  state.routePolylines = [];
  const pts = state.stops.map(s=>({lat:s.lat, lng:s.lng}));
  if(pts.length < 2) return;
  const strokeC = cssVar('--brand') || '#2563eb';

  const MAX_PTS = 25; // origin + 23 waypoints + destination
  let i = 0;
  let totalSeconds = 0;
  let totalMeters = 0;

  while(i < pts.length-1){
    const chunk = pts.slice(i, Math.min(i + MAX_PTS, pts.length));
    const origin = chunk[0];
    const destination = chunk[chunk.length-1];
    const waypoints = chunk.slice(1, -1).map(p=>({location:p, stopover:false}));

    await new Promise((resolve)=>{
      state.directionsService.route({
        origin, destination, waypoints, travelMode: google.maps.TravelMode.WALKING, optimizeWaypoints:false
      }, (result, status)=>{
        if(status === "OK" && result?.routes?.[0]){
          const route = result.routes[0];
          if(route.legs){
            route.legs.forEach(l=>{
              totalSeconds += (l.duration?.value||0);
              totalMeters += (l.distance?.value||0);
            });
          }
          const path = route.overview_path;
          const poly = new google.maps.Polyline({ path, map: state.map, strokeOpacity: 0.85, strokeWeight: 4, strokeColor: strokeC });
          state.routePolylines.push(poly);
        }else{
          const simple = new google.maps.Polyline({ path: chunk, map: state.map, strokeOpacity: 0.85, strokeWeight: 4, strokeColor: strokeC });
          state.routePolylines.push(simple);
        }
        resolve();
      });
    });
    i += (MAX_PTS - 1);
  }

  if(totalSeconds > 0){
    const mins = totalSeconds/60;
    document.querySelector("#etaTotal").textContent = minutesToHuman(mins);
  }
  if(totalMeters > 0){
    const km = (totalMeters/1000).toFixed(1);
    const el = document.querySelector('#distanceTotal'); if(el) el.textContent = `${km} km`;
  }
  updateFullRouteVisibility();
}

function updateFullRouteVisibility(){
  if(!state.routePolylines) return;
  const mapRef = state.showFullRoute ? state.map : null;
  state.routePolylines.forEach(pl=>pl.setMap(mapRef));
}

/** Geolocalización en tiempo real */
function setupGeolocation(){
  if(!("geolocation" in navigator)){ showDiag("Tu navegador no soporta Geolocalización. Usa ‘Siguiente parada’."); return; }
  try{ state.watchId = navigator.geolocation.watchPosition(onGeo, onGeoError, { enableHighAccuracy:true, maximumAge:5000, timeout:15000 }); }catch(e){ onGeoError(e); }
}
function onGeo(pos){
  const { latitude:lat, longitude:lng, accuracy } = pos.coords;
  const here = new google.maps.LatLng(lat,lng);
  if(!state.userMarker){
    state.userMarker = new google.maps.Marker({ position: here, map: state.map, title:"Mi posición", icon:"https://maps.gstatic.com/mapfiles/ms2/micons/man.png" });
    state.userCircle = new google.maps.Circle({ strokeOpacity:0.2, fillOpacity:0.08, map: state.map, center: here, radius: Math.min(accuracy||25, 60) });
  }else{
    state.userMarker.setPosition(here); state.userCircle.setCenter(here); state.userCircle.setRadius(Math.min(accuracy||25, 60));
  }
}
function onGeoError(err){ try{ localStorage.setItem("tapas_metric_geoerr", String(state.metrics.geoErrors + 1)); }catch{}; console.warn("Geolocalización error:", err && (err.message||err.code)); showDiag("No se pudo obtener tu posición. Revisa permisos o usa ‘Siguiente parada’."); }
function showDiag(msg){
  const d=document.createElement('div'); d.className='diag'; d.textContent=msg;
  document.body.appendChild(d); setTimeout(()=>d.remove(), 5000);
}
