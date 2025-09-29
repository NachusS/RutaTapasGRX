/* App principal de la Ruta de Tapas por Granada (v6.2) */
const LS_KEYS = {
  PROGRESS: "tapas_progress",
  THEME: "tapas_theme",
  NEXT: "tapas_nextStopId"
};

let map, directionsService, directionsRenderer;
let userMarker = null;
let routePolyline = null;
let markers = new Map(); // stopId -> google.maps.Marker
let stops = [];
let meta = null;

/* ==== Toast API ==== */
let toastContainer = null;
function ensureToastContainer(){
  if(!toastContainer){
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}
function showToast({title="", message="", actions=[] , timeout=6000}){
  ensureToastContainer();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    ${title ? `<div class="title">${title}</div>` : ""}
    <div class="msg">${message}</div>
    <div class="actions"></div>
  `;
  const actionsEl = el.querySelector('.actions');
  actions.forEach(a=>{
    const b = document.createElement('button');
    b.className = a.ghost ? 'btn btn-ghost' : 'btn';
    b.textContent = a.label || 'OK';
    b.addEventListener('click', ()=>{
      try{ a.onClick && a.onClick(); }finally{ el.remove(); }
    });
    actionsEl.appendChild(b);
  });
  toastContainer.appendChild(el);
  if(timeout){
    setTimeout(()=>{ el.remove(); }, timeout);
  }
}

/* === v6.1: resolver de fotos (prioriza local) === */
function resolvePhoto(stop){
  if(stop.photo_local) return stop.photo_local;
  if(stop.photo) return stop.photo;
  return "assets/cover.jpg";
}

/* === V5: ETA + llegada automática === */
let currentTargetId = null;
let arrivalPromptShown = false;
let lastDirections = null;

function setETA(distanceText, durationText, label=""){
  const box = document.getElementById('etaBox');
  if(!box) return;
  const prefix = label ? (label + ": ") : "";
  box.textContent = `${prefix}Dist.: ${distanceText || "—"} | Tiempo: ${durationText || "—"}`;
}
function clearETA(){ setETA("—", "—", ""); }

function extractTotalsFromDirections(dirResult){
  try{
    const route = dirResult.routes[0];
    let meters = 0, seconds = 0;
    route.legs.forEach(l=>{
      meters += (l.distance?.value || 0);
      seconds += (l.duration?.value || 0);
    });
    const km = (meters/1000).toFixed(1) + " km";
    const mins = Math.round(seconds/60) + " min";
    return { distanceText: km, durationText: mins };
  }catch(e){
    return { distanceText: "—", durationText: "—" };
  }
}
function haversineMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ==== Metrics update ==== */
function updateMetrics(){
  try{
    const p = getProgress();
    const total = stops.length;
    const done = stops.filter(s => p[s.id]).length;
    const mStops = document.getElementById('mStops');
    const mDistance = document.getElementById('mDistance');
    const mTime = document.getElementById('mTime');
    if(mStops) mStops.textContent = `Paradas: ${done}/${total}`;

    if(lastDirections){
      const t = extractTotalsFromDirections(lastDirections);
      if(mDistance) mDistance.textContent = `Dist. total: ${t.distanceText}`;
      if(mTime) mTime.textContent = `Tiempo total: ${t.durationText}`;
    }else{
      if(mDistance) mDistance.textContent = `Dist. total: —`;
      if(mTime) mTime.textContent = `Tiempo total: —`;
    }
  }catch(e){ /* noop */ }
}

const els = {
  panel: null,
  progressText: null,
  progressBar: null,
  startBtn: null,
  nextBtn: null,
  resetBtn: null,
  themeBtn: null
};

// Callback global para Google Maps
window.initMap = async function initMap(){
  els.panel = document.getElementById('panel');
  els.progressText = document.getElementById('progressText');
  els.progressBar = document.getElementById('progressBar');
  els.startBtn = document.getElementById('startBtn');
  els.nextBtn = document.getElementById('nextBtn');
  els.resetBtn = document.getElementById('resetBtn');
  els.themeBtn = document.getElementById('themeBtn');

  bindUI();

  const savedTheme = localStorage.getItem(LS_KEYS.THEME) || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  try{
    const res = await fetch('data/stops.json');
    const data = await res.json();
    meta = data.meta;
    stops = (data.stops || []).slice().sort((a,b)=> (a.order??999)-(b.order??999));
  }catch(err){
    console.error("Error al cargar stops.json", err);
    showToast({title:"Error",message:"No se pudieron cargar las paradas."});
    return;
  }

  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: meta?.start?.lat || 37.17855, lng: meta?.start?.lng || -3.60360 },
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
  directionsRenderer.setMap(map);

  drawMarkers();
  drawBasePolyline();
  renderCards();
  updateProgressUI();
  startGeolocationWatch();
  updateMetrics();
};

function bindUI(){
  document.getElementById('themeBtn').addEventListener('click', ()=>{
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(LS_KEYS.THEME, next);
  });

  document.getElementById('resetBtn').addEventListener('click', ()=>{
    localStorage.removeItem(LS_KEYS.PROGRESS);
    localStorage.removeItem(LS_KEYS.NEXT);
    updateProgressUI();
    renderCards();
    updateMetrics();
  });

  document.getElementById('startBtn').addEventListener('click', ()=>{
    routeRemainingItinerary();
    const next = getNextStop();
    if(next){ localStorage.setItem(LS_KEYS.NEXT, next.id); }
  });

  document.getElementById('nextBtn').addEventListener('click', ()=>{
    const next = getNextStop();
    if(next){
      localStorage.setItem(LS_KEYS.NEXT, next.id);
      routeToStop(next.id);
    }else{
      if(meta?.end){ drawDirections(meta.end); }
    }
  });
}

/* Marcadores y popups */
function drawMarkers(){
  markers.clear();
  if(meta?.start){
    new google.maps.Marker({
      position: {lat: meta.start.lat, lng: meta.start.lng},
      map, title: `Inicio: ${meta.start.name}`,
      icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale:6, fillColor:"#22c55e", fillOpacity:1, strokeColor:"#14532d", strokeWeight:1.5 }
    });
  }
  if(meta?.end){
    new google.maps.Marker({
      position: {lat: meta.end.lat, lng: meta.end.lng},
      map, title: `Fin: ${meta.end.name}`,
      icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale:6, fillColor:"#0ea5e9", fillOpacity:1, strokeColor:"#0c4a6e", strokeWeight:1.5 }
    });
  }
  const info = new google.maps.InfoWindow();
  for(const stop of stops){
    const m = new google.maps.Marker({
      position: {lat: stop.lat, lng: stop.lng},
      map, title: stop.name
    });
    m.addListener('click', ()=>{
      const done = isDone(stop.id);
      const links = [
        stop.card_photo ? `<a href='${stop.card_photo}' target='_blank' rel='noopener'>Tapa</a>` : '',
        stop.website ? `<a href='${stop.website}' target='_blank' rel='noopener'>Web</a>` : '',
        stop.gmaps ? `<a href='${stop.gmaps}' target='_blank' rel='noopener'>Maps</a>` : '',
        stop.phone ? `<a href='tel:${stop.phone}'>Tel</a>` : ''
      ].filter(Boolean).join(' · ');
      const html = `
        <div style="max-width:260px">
          <strong>${stop.name}</strong><br/>
          <span style="color:#64748b">${stop.tapa || ""}</span><br/>
          <small style="color:#64748b">${stop.address || ""}</small><br/>
          <div style="margin:.35rem 0">${links}</div>
          <div style="margin-top:.4rem; display:flex; gap:.4rem; flex-wrap:wrap">
            <button data-stop="${stop.id}" class="gm-btn gm-go">Ir</button>
            <button data-stop="${stop.id}" class="gm-btn gm-done">${done? "Desmarcar" : "Marcar hecha"}</button>
          </div>
        </div>`;
      info.setContent(html);
      info.open(map, m);
      setTimeout(()=>{
        const goBtn = document.querySelector('.gm-btn.gm-go');
        const doneBtn = document.querySelector('.gm-btn.gm-done');
        if(goBtn){ goBtn.addEventListener('click', ()=> routeToStop(stop.id)); }
        if(doneBtn){ doneBtn.addEventListener('click', ()=>{ toggleDone(stop.id); info.close(); }); }
      },0);
    });
    markers.set(stop.id, m);
  }
}

function drawBasePolyline(){
  if(routePolyline){ routePolyline.setMap(null); routePolyline = null; }
  const path = stops.map(s => ({lat:s.lat, lng:s.lng}));
  routePolyline = new google.maps.Polyline({ path, geodesic:true, strokeColor:"#34d399", strokeOpacity:0.8, strokeWeight:4 });
  routePolyline.setMap(map);

  const bounds = new google.maps.LatLngBounds();
  if(meta?.start) bounds.extend(new google.maps.LatLng(meta.start.lat, meta.start.lng));
  for(const s of stops) bounds.extend(new google.maps.LatLng(s.lat, s.lng));
  if(meta?.end) bounds.extend(new google.maps.LatLng(meta.end.lat, meta.end.lng));
  map.fitBounds(bounds);
}

function renderCards(){
  const progress = getProgress();
  const panel = document.getElementById('panel');
  panel.innerHTML = "";
  for(const stop of stops){
    const done = !!progress[stop.id];
    const card = document.createElement('article');
    card.className = "card";
    const imgSrc = resolvePhoto(stop);
    const facade = stop.photo_local || imgSrc;
    const tapa = stop.card_photo || "";
    const tel = stop.phone ? `<a href="tel:${stop.phone}">${stop.phone}</a>` : "";
    const web = stop.website ? `<a href="${stop.website}" target="_blank" rel="noopener">Web</a>` : "";
    const gmaps = stop.gmaps ? `<a href="${stop.gmaps}" target="_blank" rel="noopener">Ver en Google Maps</a>` : "";
    const price = stop.price || "";
    const tags = (stop.tags||[]).map(t=>`<span class='badge'>${t}</span>`).join(' ');
    const address = stop.address ? `<span class='badge'>${stop.address}</span>` : "";
    const hours = stop.hours ? `<div>🕒 ${stop.hours}</div>` : "";
    const details = `
      <div class='details'>
        ${address}
        ${hours}
        ${price ? `<div>💶 ${price}</div>` : ""}
        <div class='meta'>${tel} ${web} ${gmaps}</div>
      </div>
    `;
    card.innerHTML = `
      <img src="${facade}" alt="Foto de ${stop.name}" loading="lazy" width="160" height="160" />
      <div class="card-body">
        <div class="card-title">${stop.order}. ${stop.name}</div>
        <p class="card-sub">Tapa típica: <strong>${stop.tapa || "—"}</strong></p>
        ${tags}
        ${details}
        ${tapa ? `<div class="card-sub" style="margin-top:.4rem">📷 <a href="${tapa}" target="_blank" rel="noopener">Ver foto de la tapa</a></div>` : ""}
        <div class="card-actions">
          <button class="btn" data-action="go" data-stop="${stop.id}">Ir a esta parada</button>
          <button class="btn btn-ghost" data-action="done" data-stop="${stop.id}">${done? "Desmarcar" : "Marcar como hecha"}</button>
        </div>
      </div>
    `;
    panel.appendChild(card);
  }

  panel.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const stopId = btn.getAttribute('data-stop');
    const action = btn.getAttribute('data-action');
    if(action === 'go'){
      routeToStop(stopId);
      localStorage.setItem(LS_KEYS.NEXT, stopId);
    }else if(action === 'done'){
      toggleDone(stopId);
    }
  });
}

function routeToStop(stopId){
  currentTargetId = stopId;
  arrivalPromptShown = false;
  const stop = stops.find(s=> s.id === stopId);
  if(!stop){ return; }
  drawDirections({ lat: stop.lat, lng: stop.lng });
  const m = markers.get(stopId);
  if(m){
    map.panTo(m.getPosition());
    m.setAnimation(google.maps.Animation.DROP);
    setTimeout(()=> m.setAnimation(null), 1000);
  }
}

function drawDirections(dest){
  if(!dest) return;
  let origin = null;
  if(userMarker){
    origin = userMarker.getPosition();
  }else if(meta?.start){
    origin = new google.maps.LatLng(meta.start.lat, meta.start.lng);
  }else if(stops.length){
    origin = new google.maps.LatLng(stops[0].lat, stops[0].lng);
  }

  directionsService.route({
    origin,
    destination: dest,
    travelMode: google.maps.TravelMode.WALKING
  }, (result, status)=>{
    if(status === "OK"){
      directionsRenderer.setDirections(result);
      lastDirections = result;
      const t = extractTotalsFromDirections(result);
      setETA(t.distanceText, t.durationText, currentTargetId ? "Siguiente" : "Ruta");
      updateMetrics();
    }else{
      console.warn("Directions API falló, fallback:", status);
      const path = [origin, new google.maps.LatLng(dest.lat, dest.lng)];
      const fallback = new google.maps.Polyline({ path, geodesic:true, strokeColor:"#0ea5e9", strokeOpacity:0.9, strokeWeight:5 });
      fallback.setMap(map);
      directionsRenderer.set('directions', null);
    }
  });
}

/* Itinerario completo restante (waypoints) */
function getLastCompletedStop(){
  const p = getProgress();
  let last = null;
  for(const s of stops){ if(p[s.id]) last = s; }
  return last;
}
function getRemainingStops(){
  const p = getProgress();
  return stops.filter(s => !p[s.id]);
}
function routeRemainingItinerary(){
  const remaining = getRemainingStops();
  if(!remaining.length){
    if(meta?.end){ drawDirections({ lat: meta.end.lat, lng: meta.end.lng }); }
    return;
  }
  let origin = null;
  if(userMarker){
    origin = userMarker.getPosition();
  }else{
    const last = getLastCompletedStop();
    if(last){ origin = new google.maps.LatLng(last.lat, last.lng); }
    else if(meta?.start){ origin = new google.maps.LatLng(meta.start.lat, meta.start.lng); }
    else { origin = new google.maps.LatLng(remaining[0].lat, remaining[0].lng); }
  }
  const destStop = remaining[remaining.length - 1];
  const wps = remaining.slice(0, Math.max(0, remaining.length - 1)).map(s => ({
    location: new google.maps.LatLng(s.lat, s.lng), stopover: true
  }));

  directionsService.route({
    origin,
    destination: new google.maps.LatLng(destStop.lat, destStop.lng),
    waypoints: wps,
    optimizeWaypoints: false,
    travelMode: google.maps.TravelMode.WALKING
  }, (result, status) => {
    if(status === "OK"){
      directionsRenderer.setDirections(result);
      lastDirections = result;
      const t = extractTotalsFromDirections(result);
      setETA(t.distanceText, t.durationText, "Itinerario restante");
      updateMetrics();
    }else{
      console.warn("No se pudo trazar el itinerario restante:", status);
      directionsRenderer.set('directions', null);
      drawBasePolyline();
    }
  });
}

function startGeolocationWatch(){
  if(!('geolocation' in navigator)){
    console.warn("Geolocalización no disponible.");
    return;
  }
  navigator.geolocation.watchPosition((pos)=>{
    const { latitude, longitude } = pos.coords;
    const latlng = new google.maps.LatLng(latitude, longitude);
    if(!userMarker){
      userMarker = new google.maps.Marker({
        position: latlng, map, title: "Tu posición",
        icon: { path: google.maps.SymbolPath.CIRCLE, scale:6, fillColor:"#ef4444", fillOpacity:1, strokeColor:"#7f1d1d", strokeWeight:1.5 }
      });
    }else{
      userMarker.setPosition(latlng);
    }

    // Llegada automática con toast
    try{
      if(currentTargetId){
        const target = stops.find(s => s.id === currentTargetId);
        if(target){
          const dist = haversineMeters(latitude, longitude, target.lat, target.lng);
          if(dist <= 35 && !arrivalPromptShown){
            arrivalPromptShown = true;
            showToast({
              title:'Llegada',
              message:`Has llegado a "${target.name}". ¿Marcar esta parada como hecha?`,
              actions:[
                {label:'Sí, marcar', onClick:()=>{
                  if(!isDone(currentTargetId)) toggleDone(currentTargetId);
                  currentTargetId = null;
                  routeRemainingItinerary();
                }},
                {label:'No, luego', ghost:true, onClick:()=>{
                  setTimeout(()=>{ arrivalPromptShown = false; }, 15000);
                }}
              ],
              timeout:10000
            });
          }
        }
      }
    }catch(e){ console.warn("Error en llegada:", e); }

  }, (err)=>{
    console.warn("No se pudo obtener la ubicación:", err.message);
  }, { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
}

/* ---------- Estado / progreso ---------- */
function getProgress(){
  try{ return JSON.parse(localStorage.getItem(LS_KEYS.PROGRESS)) || {}; }catch{ return {}; }
}
function setProgress(obj){ localStorage.setItem(LS_KEYS.PROGRESS, JSON.stringify(obj)); }
function isDone(stopId){ const p = getProgress(); return !!p[stopId]; }
function toggleDone(stopId){
  const p = getProgress();
  const wasNext = getNextStop()?.id === stopId;
  p[stopId] = !p[stopId];
  setProgress(p);
  updateProgressUI();
  renderCards();
  updateMetrics();
  if(wasNext || p[stopId]){ routeRemainingItinerary(); }
}
function updateProgressUI(){
  const p = getProgress();
  const total = stops.length;
  const done = stops.filter(s => p[s.id]).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  document.getElementById('progressText').textContent = `Progreso: ${done} / ${total}`;
  document.getElementById('progressBar').style.width = pct + "%";
}
function getNextStop(){
  const p = getProgress();
  for(const s of stops){ if(!p[s.id]) return s; }
  return null;
}
