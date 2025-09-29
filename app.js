/* App principal de la Ruta de Tapas por Granada (SPA estática) */
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

const els = {
  panel: null,
  progressText: null,
  progressBar: null,
  startBtn: null,
  nextBtn: null,
  resetBtn: null,
  themeBtn: null
};

// Exponer callback global para Google Maps
window.initMap = async function initMap(){
  els.panel = document.getElementById('panel');
  els.progressText = document.getElementById('progressText');
  els.progressBar = document.getElementById('progressBar');
  els.startBtn = document.getElementById('startBtn');
  els.nextBtn = document.getElementById('nextBtn');
  els.resetBtn = document.getElementById('resetBtn');
  els.themeBtn = document.getElementById('themeBtn');

  bindUI();

  // Tema
  const savedTheme = localStorage.getItem(LS_KEYS.THEME) || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  // Cargar datos
  try{
    const res = await fetch('data/stops.json');
    const data = await res.json();
    meta = data.meta;
    stops = (data.stops || []).slice().sort((a,b)=> (a.order??999)-(b.order??999));
  }catch(err){
    console.error("Error al cargar stops.json", err);
    alert("No se pudieron cargar las paradas. Revisa data/stops.json");
    return;
  }

  // Inicializar mapa
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: meta?.start?.lat || 37.17855, lng: meta?.start?.lng || -3.60360 },
    zoom: 15,
    mapTypeControl: false,
    streetViewControl: false
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
  directionsRenderer.setMap(map);

  // Markers y polyline base
  drawMarkers();
  drawBasePolyline();

  // UI de tarjetas
  renderCards();
  updateProgressUI();

  // Geolocalización
  startGeolocationWatch();
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
    // Recalcular ruta hacia primera parada si se desea
  });

  document.getElementById('startBtn').addEventListener('click', ()=>{
    // Al comenzar, si no hay next guardado, vamos a la primera parada no completada
    const next = getNextStop();
    if(next){
      localStorage.setItem(LS_KEYS.NEXT, next.id);
      routeToStop(next.id);
    }else{
      alert("No hay paradas disponibles.");
    }
  });

  document.getElementById('nextBtn').addEventListener('click', ()=>{
    const next = getNextStop();
    if(next){
      localStorage.setItem(LS_KEYS.NEXT, next.id);
      routeToStop(next.id);
    }else{
      // Si no hay siguiente, ir al fin de ruta
      if(meta?.end){
        drawDirections(meta.end);
      }
    }
  });
}

function drawMarkers(){
  markers.clear();

  // Inicio y fin con iconos distintos
  if(meta?.start){
    new google.maps.Marker({
      position: {lat: meta.start.lat, lng: meta.start.lng},
      map,
      title: `Inicio: ${meta.start.name}`,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#22c55e",
        fillOpacity: 1,
        strokeColor: "#14532d",
        strokeWeight: 1.5
      }
    });
  }

  if(meta?.end){
    new google.maps.Marker({
      position: {lat: meta.end.lat, lng: meta.end.lng},
      map,
      title: `Fin: ${meta.end.name}`,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#0ea5e9",
        fillOpacity: 1,
        strokeColor: "#0c4a6e",
        strokeWeight: 1.5
      }
    });
  }

  // Paradas
  const info = new google.maps.InfoWindow();
  for(const stop of stops){
    const m = new google.maps.Marker({
      position: {lat: stop.lat, lng: stop.lng},
      map,
      title: stop.name
    });
    m.addListener('click', ()=>{
      const done = isDone(stop.id);
      const html = `
        <div style="max-width:240px">
          <strong>${stop.name}</strong><br/>
          <span style="color:#64748b">${stop.tapa || ""}</span><br/>
          <div style="margin-top:.4rem; display:flex; gap:.4rem; flex-wrap:wrap">
            <button data-stop="${stop.id}" class="gm-btn gm-go">Ir</button>
            <button data-stop="${stop.id}" class="gm-btn gm-done">${done? "Desmarcar" : "Marcar hecha"}</button>
          </div>
        </div>`;
      info.setContent(html);
      info.open(map, m);
      // Delegación simple tras abrir
      setTimeout(()=>{
        const goBtn = document.querySelector('.gm-btn.gm-go');
        const doneBtn = document.querySelector('.gm-btn.gm-done');
        if(goBtn){
          goBtn.addEventListener('click', ()=> routeToStop(stop.id));
        }
        if(doneBtn){
          doneBtn.addEventListener('click', ()=>{
            toggleDone(stop.id);
            info.close();
          });
        }
      },0);
    });
    markers.set(stop.id, m);
  }
}

function drawBasePolyline(){
  if(routePolyline){
    routePolyline.setMap(null);
    routePolyline = null;
  }
  const path = stops.map(s => ({lat:s.lat, lng:s.lng}));
  routePolyline = new google.maps.Polyline({
    path,
    geodesic:true,
    strokeColor:"#34d399",
    strokeOpacity:0.8,
    strokeWeight:4
  });
  routePolyline.setMap(map);

  // Fit bounds a toda la ruta
  const bounds = new google.maps.LatLngBounds();
  if(meta?.start) bounds.extend(new google.maps.LatLng(meta.start.lat, meta.start.lng));
  for(const s of stops) bounds.extend(new google.maps.LatLng(s.lat, s.lng));
  if(meta?.end) bounds.extend(new google.maps.LatLng(meta.end.lat, meta.end.lng));
  map.fitBounds(bounds);
}

function renderCards(){
  const progress = getProgress();
  els.panel.innerHTML = "";
  for(const stop of stops){
    const done = !!progress[stop.id];
    const card = document.createElement('article');
    card.className = "card";
    const imgSrc = stop.photo || "assets/placeholder.jpg";
    card.innerHTML = `
      <img src="${imgSrc}" alt="Foto de ${stop.name}" loading="lazy" width="120" height="120" />
      <div class="card-body">
        <div class="card-title">${stop.order}. ${stop.name}</div>
        <p class="card-sub">Tapa típica: <strong>${stop.tapa || "—"}</strong></p>
        ${stop.address ? `<span class="badge">${stop.address}</span>` : ""}
        <div class="card-actions">
          <button class="btn" data-action="go" data-stop="${stop.id}">Ir a esta parada</button>
          <button class="btn btn-ghost" data-action="done" data-stop="${stop.id}">${done? "Desmarcar" : "Marcar como hecha"}</button>
        </div>
      </div>
    `;
    els.panel.appendChild(card);
  }

  // Delegación de eventos
  els.panel.addEventListener('click', (e)=>{
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
  }, { once: true }); // se reatacha en cada render
}

function routeToStop(stopId){
  const stop = stops.find(s=> s.id === stopId);
  if(!stop){ return; }
  drawDirections({ lat: stop.lat, lng: stop.lng });
  // Enfocar marker
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
  }else{
    origin = new google.maps.LatLng(stops[0].lat, stops[0].lng);
  }

  directionsService.route({
    origin,
    destination: dest,
    travelMode: google.maps.TravelMode.WALKING
  }, (result, status)=>{
    if(status === "OK"){
      directionsRenderer.setDirections(result);
    }else{
      console.warn("Directions API falló, usar polyline como fallback:", status);
      // Fallback: línea recta
      const path = [origin, new google.maps.LatLng(dest.lat, dest.lng)];
      const fallback = new google.maps.Polyline({
        path, geodesic:true, strokeColor:"#0ea5e9", strokeOpacity:0.9, strokeWeight:5
      });
      fallback.setMap(map);
      // Limpia el renderer para no dejar una ruta incorrecta
      directionsRenderer.set('directions', null);
    }
  });
}

function startGeolocationWatch(){
  if(!('geolocation' in navigator)){
    console.warn("Geolocalización no disponible en este navegador.");
    return;
  }
  navigator.geolocation.watchPosition((pos)=>{
    const { latitude, longitude } = pos.coords;
    const latlng = new google.maps.LatLng(latitude, longitude);
    if(!userMarker){
      userMarker = new google.maps.Marker({
        position: latlng,
        map,
        title: "Tu posición",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#7f1d1d",
          strokeWeight: 1.5
        }
      });
    }else{
      userMarker.setPosition(latlng);
    }
  }, (err)=>{
    console.warn("No se pudo obtener la ubicación:", err.message);
  }, { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
}

/* ---------- Estado / progreso ---------- */
function getProgress(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEYS.PROGRESS)) || {};
  }catch{ return {}; }
}

function setProgress(obj){
  localStorage.setItem(LS_KEYS.PROGRESS, JSON.stringify(obj));
}

function isDone(stopId){
  const p = getProgress();
  return !!p[stopId];
}

function toggleDone(stopId){
  const p = getProgress();
  p[stopId] = !p[stopId];
  setProgress(p);
  updateProgressUI();
  renderCards();
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
  for(const s of stops){
    if(!p[s.id]) return s;
  }
  return null;
}
