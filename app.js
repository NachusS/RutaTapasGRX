/* RutaTapas · v5.0 */
const state = {
  map: null,
  directionsService: null,
  directionsRenderer: null,
  userMarker: null,
  userCircle: null,
  markers: new Map(),
  stops: [],
  routeMeta: null,
  currentTargetId: null,
  watchId: null,
  metrics: {
    opens: Number(localStorage.getItem("tapas_metric_opens")||0),
    nextClicks: Number(localStorage.getItem("tapas_metric_next")||0),
    geoErrors: Number(localStorage.getItem("tapas_metric_geoerr")||0),
  }
};

const LS_KEYS = { progress: "tapas_progress", theme: "tapas_theme", next: "tapas_nextStopId" };
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || null;
}


function loadJSON(url){ return fetch(url, {cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status} al cargar ${url}`); return r.json(); }); }
function getProgress(){ try{ return JSON.parse(localStorage.getItem(LS_KEYS.progress) || "{}"); }catch{ return {}; } }
function setProgress(obj){ localStorage.setItem(LS_KEYS.progress, JSON.stringify(obj)); }
function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(LS_KEYS.theme, theme);
  $("#toggleThemeBtn")?.setAttribute("aria-pressed", theme === "dark");
  // Update polyline colors to match theme
  const c = cssVar('--brand') || '#2563eb';
  if(state.routePolylines){ state.routePolylines.forEach(pl=>pl.setOptions({strokeColor: c})); }
}
function toggleTheme(){ const now=document.documentElement.getAttribute("data-theme"); setTheme(now==="dark"?"light":"dark"); }
function minutesToHuman(min){ if(!Number.isFinite(min)) return "–"; const h=Math.floor(min/60); const m=Math.round(min%60); return h>0?`${h} h ${m} min`:`${m} min`; }

window.initMap = async function initMap(){
  setTheme(localStorage.getItem(LS_KEYS.theme) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light"));
  try{ localStorage.setItem("tapas_metric_opens", String(state.metrics.opens + 1)); }catch{}

  const routes = await loadJSON("data/routes.json").catch(_ => ({ routes: [
    { id:"granada", name:"Granada · Ruta de tapas", file:"stops.json", cityCenter:{lat:37.1765,lng:-3.5979}},
    { id:"lorca", name:"Lorca · Ruta de tapas", file:"stops_lorca.json", cityCenter:{lat:37.6712,lng:-1.7006}}
  ]}));

  const routeSelect = $("#routeSelect");
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

  await loadRouteById(routes, selectedId);
  setupGeolocation();
};

async function loadRouteById(routes, id){
  const meta = routes.routes.find(r=>r.id===id || r.title===id) || routes.routes[0];
  state.routeMeta = meta;
  $("#routeLabel").textContent = (meta?.name || meta?.title || "Ruta");

  const filePath = (meta.file||'stops.json');
  const finalPath = filePath.startsWith('data/') ? filePath : `data/${filePath}`;
  const data = await loadJSON(finalPath);
  state.lastLoadedMeta = data; // guarda meta para centro y títulos
  const stops = (data.stops||[]).slice().sort((a,b)=> (a.order||0)-(b.order||0));
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
  if(stops && stops.length){ center = {lat:stops[0].lat, lng:stops[0].lng}; }
  // intenta meta.start del propio fichero de paradas
  try{ if(state.lastLoadedMeta && state.lastLoadedMeta.meta && state.lastLoadedMeta.meta.start){ const s = state.lastLoadedMeta.meta.start; center = {lat: s.lat, lng: s.lng}; } }catch{}
  // si no, usa cityCenter del routes.json
  if(!center && meta && meta.cityCenter) center = meta.cityCenter;
  if(center) state.map.setCenter(center);

  for(const s of stops){
    const marker = new google.maps.Marker({
      position: {lat:s.lat,lng:s.lng},
      map: state.map,
      icon: (s.order===1 || s.order===stops.length) ? "https://maps.gstatic.com/mapfiles/ms2/micons/flag.png" : undefined,
      title: `${s.order}. ${s.name}`
    });
    const info = new google.maps.InfoWindow({ content: `<strong>${s.order}. ${s.name}</strong><br><small>${s.address||""}</small>` });
    marker.addListener("click", ()=>{ info.open({anchor:marker, map:state.map}); goTo(s.id); });
    state.markers.set(s.id, marker);
  }

  const path = stops.map(s=>({lat:s.lat, lng:s.lng}));
  state.poly && state.poly.setMap(null);
  state.poly = new google.maps.Polyline({ path, geodesic:false, strokeOpacity:0.0, map: state.map });

  const bounds = new google.maps.LatLngBounds();
  path.forEach(p=>bounds.extend(p));
  try{ state.map.fitBounds(bounds); }catch{}
}

function buildList(stops){
  const panel = $("#panel"); panel.innerHTML="";
  const progress = getProgress();
  for(const s of stops){
    const card = document.createElement("article");
    card.className = "card"; card.setAttribute("tabindex","0");
    card.innerHTML = `
      <img src="${s.photo || `assets/${s.id||'placeholder'}.jpg`}" alt="Foto de ${s.name}">
      <div>
        <h3>${s.order}. ${s.name} ${s.order===1?'<span class="badge">Inicio</span>':''}${s.order===stops.length?'<span class="badge">Fin</span>':''}</h3>
        <p>${s.tapa?`Tapa típica: ${s.tapa}`:''}</p>
        <p>${s.address||''}</p>
        <div class="actions">
          <button class="btn" data-act="toggle" data-id="${s.id}" aria-pressed="${!!progress[s.id]}">${progress[s.id]?'Desmarcar':'Marcar como hecha'}</button>
          <button class="btn" data-act="goto" data-id="${s.id}">Ir a esta parada</button>
        </div>
      </div>
    `;
    panel.appendChild(card);
  }
  panel.addEventListener("click", (e)=>{ const btn=e.target.closest("button[data-act]"); if(!btn) return; const id=btn.getAttribute("data-id"); const act=btn.getAttribute("data-act"); if(act==="toggle") toggleDone(id); if(act==="goto") goTo(id); });
  panel.addEventListener("keydown",(e)=>{ if((e.key==="Enter"||e.key===" ") && e.target.matches(".card")){ const idx=Array.from(panel.children).indexOf(e.target); const s=state.stops[idx]; if(s) goTo(s.id); } });
}

function restoreProgressUI(){
  const progress = getProgress();
  $$("#panel button[data-act='toggle']").forEach(btn=>{
    const id = btn.getAttribute("data-id");
    const done = !!progress[id];
    btn.textContent = done? "Desmarcar":"Marcar como hecha";
    btn.setAttribute("aria-pressed", String(done));
    const card = btn.closest(".card"); card.style.opacity = done ? .6 : 1;
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
  if(mk){ state.map.panTo(mk.getPosition()); state.map.setZoom(16); new google.maps.InfoWindow({content:`<strong>${stop.name}</strong>`}).open({anchor:mk, map:state.map}); }
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

function setupGeolocation(){
  if(!("geolocation" in navigator)){ toast("Tu navegador no soporta Geolocalización. Puedes navegar manualmente con ‘Siguiente parada’."); return; }
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
function onGeoError(err){ try{ localStorage.setItem("tapas_metric_geoerr", String(state.metrics.geoErrors + 1)); }catch{}; console.warn("Geolocalización error:", err && (err.message||err.code)); toast("No se pudo obtener tu posición. Revisa permisos o usa ‘Siguiente parada’.", true); }
function toast(msg, warn=false){
  let el=document.createElement("div"); el.role="status"; el.setAttribute("aria-live","polite");
  Object.assign(el.style,{position:"fixed",left:"50%",bottom:"16px",transform:"translateX(-50%)",background:warn?"#ef4444":"#111827",color:"#fff",padding:"10px 14px",borderRadius:"12px",boxShadow:"0 6px 18px rgba(0,0,0,.25)",zIndex:"9999"});
  el.textContent=msg; document.body.appendChild(el); setTimeout(()=>{ el.remove(); }, 3000);
}


/** =========================
 *  Ruta completa (chunked waypoints) para mostrar el tracking a pie entre TODAS las paradas
 *  - Máx 25 puntos por petición (origen+destino+23 waypoints)
 *  - Unimos los overview_paths en polylines
 *  ========================= */
async function buildFullRoutePolyline(){
  const strokeC = cssVar('--brand') || '#2563eb';
  // Limpia polylines anteriores
  if(state.routePolylines){ state.routePolylines.forEach(pl=>pl.setMap(null)); }
  state.routePolylines = [];

  const pts = state.stops.map(s=>({lat:s.lat, lng:s.lng}));
  if(pts.length < 2) return;

  const MAX_PTS = 25; // origin + 23 waypoints + destination
  let i = 0;
  let totalSeconds = 0;
  let totalMeters = 0;

  while(i < pts.length-1){
    const chunk = pts.slice(i, Math.min(i + MAX_PTS, pts.length));
    const origin = chunk[0];
    const destination = chunk[chunk.length-1];
    const waypoints = chunk.slice(1, -1).map(p=>({location:p, stopover:false}));

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve)=>{
      state.directionsService.route({
        origin, destination, waypoints, travelMode: google.maps.TravelMode.WALKING, optimizeWaypoints:false
      }, (result, status)=>{
        if(status === "OK" && result?.routes?.[0]){
          const route = result.routes[0];
          // sumamos duraciones y distancias
          if(route.legs){
            route.legs.forEach(l=>{
              totalSeconds += (l.duration?.value||0);
              totalMeters += (l.distance?.value||0);
            });
          }
          // dibujamos polyline del overview_path
          const path = route.overview_path;
          const poly = new google.maps.Polyline({ path, map: state.map, strokeOpacity: 0.85, strokeWeight: 4, strokeColor: strokeC });
          state.routePolylines.push(poly);
        }else{
          // Si falla, mostramos el fallback simple de este tramo
          const simple = new google.maps.Polyline({ path: chunk, map: state.map, strokeOpacity: 0.85, strokeWeight: 4, strokeColor: strokeC });
          state.routePolylines.push(simple);
        }
        resolve();
      });
    });

    // Avanza ventana para el próximo chunk (último punto reaprovechado como origen)
    if(i === 0) i += (MAX_PTS - 1);
    else i += (MAX_PTS - 1);
  }

  // Actualiza ETA total con la suma de la ruta completa (si hay datos)
  if(totalSeconds > 0){
    const mins = totalSeconds/60;
    document.querySelector("#etaTotal").textContent = minutesToHuman(mins);
  }
  if(totalMeters > 0){
    const km = (totalMeters/1000).toFixed(1);
    const el = document.querySelector('#distanceTotal'); if(el) el.textContent = `${km} km`;
  }
  // Si quieres mostrar distancia total, podrías añadir un span dedicado o un tooltip.
}

