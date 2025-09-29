
// === Config ===
const CSV_PATH = "data/ruta_tapas_granada.csv";
const STORAGE_KEY = "granada_tapas_checklist_v1";
const THEME_KEY = "granada_tapas_theme";

// Sugerencias de tapas si no hay columna 'Tapa' en el CSV
const DEFAULT_TAPAS = {
  "Bar Lara": "Habas con jamón",
  "Restaurante Mirador de San Nicolás": "Ensalada de tomate con ventresca",
  "Restaurante Aixa": "Pincho moruno",
  "Ladrillo II": "Caracoles / Carne en salsa",
  "Bar Aliatar": "Montadito Aliatar",
  "La Entraiya": "Berenjenas con miel",
  "Casa 1899": "Croquetas caseras",
  "Ras Café": "Tortilla de patatas",
  "Bar Minotauro": "Chorizo al infierno",
  "Taberna el 22": "Jamón y queso",
  "Taberna Cisco y Tierra": "Tosta de lomo",
  "Lumbre las brasas de Moma": "Brocheta a la brasa",
  "Restaurante La blanca Paloma centro": "Flamenquín",
  "Bar Patio Braserito": "Morcilla con piñones",
  "Taberna La Tana (Fin)": "Vino + tosta"
};

// Imagen por defecto
const PLACEHOLDER_IMG = "images/placeholder.jpg";

// === State ===
let map, directionsService, directionsRenderer;
let userMarker = null;
let stops = []; // {nombre, lat, lng, tapa?, foto?}
let checklist = {}; // nombre -> true/false

// === Theme (dark mode) ===
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") document.documentElement.classList.add("dark");
}
function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  const isDark = document.documentElement.classList.contains("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
});

// === Utils ===
function slug(s){ return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w]+/g,'-'); }
function progressText() {
  const done = Object.values(checklist).filter(v=>v).length;
  return `${done} / ${stops.length}`;
}
function saveChecklist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checklist));
  document.getElementById("progress").textContent = progressText();
}
function loadChecklist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) checklist = JSON.parse(raw);
  } catch(e){ checklist = {}; }
}

// Next uncompleted stop index
function nextIndex() {
  for (let i=0;i<stops.length;i++){
    if (!checklist[stops[i].nombre]) return i;
  }
  return -1;
}

// === Map + Route ===
window.init = async function init() {
  loadChecklist();
  await loadCSV();
  initMap();
  buildRoute();
  renderCards();
  hookControls();
  updateFlags();
  document.getElementById("progress").textContent = progressText();
  startGeolocation();
};

async function loadCSV(){
  return new Promise((resolve, reject) => {
    Papa.parse(CSV_PATH, {
      header: true,
      download: true,
      complete: (res) => {
        stops = res.data
          .filter(row => row.Nombre && row.Latitud && row.Longitud)
          .map((row, idx) => ({
            nombre: row.Nombre.trim(),
            lat: parseFloat(row.Latitud),
            lng: parseFloat(row.Longitud),
            tapa: row.Tapa && row.Tapa.trim() || DEFAULT_TAPAS[row.Nombre?.trim()] || "Tapa de la casa",
            foto: row.Foto && row.Foto.trim() || PLACEHOLDER_IMG,
            idx
          }));
        // Ensure checklist has all keys
        stops.forEach(s => { if (typeof checklist[s.nombre] !== "boolean") checklist[s.nombre] = false; });
        resolve();
      },
      error: (err) => reject(err)
    });
  });
}

function initMap(){
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: stops[0].lat, lng: stops[0].lng},
    zoom: 15,
    mapTypeControl: false,
    fullscreenControl: true,
    streetViewControl: false,
  });
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: { strokeWeight: 5 }
  });

  // Markers with start/end flags and numbered markers
  stops.forEach((s, i) => addStopMarker(s, i));
}

function flagIcon(type){
  // type: 'start' | 'end'
  const emoji = type === 'start' ? '🏁' : '🏁';
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50'>
      <text x='12' y='35' font-size='28'>${emoji}</text>
    </svg>`)},
    scaledSize: new google.maps.Size(36,36),
    anchor: new google.maps.Point(18,18)
  };
}
function numberIcon(num, done){
  const bg = done ? '#10b981' : '#0ea5e9';
  const fg = '#ffffff';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
    <circle cx='24' cy='24' r='20' fill='${bg}'/>
    <text x='24' y='30' font-size='20' text-anchor='middle' fill='${fg}' font-family='Arial' font-weight='700'>${num}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(36,36),
    anchor: new google.maps.Point(18,18)
  };
}

function addStopMarker(s, i){
  const isStart = i === 0;
  const isEnd = i === (stops.length - 1);
  const marker = new google.maps.Marker({
    position: {lat: s.lat, lng: s.lng},
    map,
    title: s.nombre,
    icon: isStart ? flagIcon('start') : isEnd ? flagIcon('end') : numberIcon(i, checklist[s.nombre])
  });
  s._marker = marker;

  const content = popupHTML(s, i);
  const infowindow = new google.maps.InfoWindow({ content });
  s._infowindow = infowindow;

  marker.addListener('click', () => {
    infowindow.setContent(popupHTML(s, i));
    infowindow.open({anchor: marker, map, shouldFocus: false});
  });
}

function popupHTML(s, i){
  const done = checklist[s.nombre];
  const btnText = done ? "Desmarcar" : "Marcar como hecha";
  const nextTxt = "Ir a siguiente ▶";
  return `
    <div style="max-width:260px">
      <img src="${s.foto}" alt="Foto ${s.nombre}" style="width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px">
      <div style="font-weight:800;margin-bottom:4px">${i}. ${s.nombre}</div>
      <div style="color:#64748b;margin-bottom:8px">Tapa típica: <strong>${s.tapa}</strong></div>
      <div style="display:flex;gap:6px">
        <button onclick="toggleDone('${encodeURIComponent(s.nombre)}')">${btnText}</button>
        <button onclick="focusNext()">${nextTxt}</button>
      </div>
    </div>
  `;
}

function updateMarkerIcons(){
  stops.forEach((s, i) => {
    const isStart = i === 0;
    const isEnd = i === stops.length-1;
    s._marker.setIcon(isStart ? flagIcon('start') : isEnd ? flagIcon('end') : numberIcon(i, checklist[s.nombre]));
  });
}

function buildRoute(){
  if (stops.length < 2) return;
  const origin = { lat: stops[0].lat, lng: stops[0].lng };
  const destination = { lat: stops[stops.length-1].lat, lng: stops[stops.length-1].lng };
  const waypoints = stops.slice(1, -1).map(s => ({ location: {lat: s.lat, lng: s.lng}, stopover: true }));

  directionsService.route({
    origin,
    destination,
    waypoints,
    travelMode: google.maps.TravelMode.WALKING,
    optimizeWaypoints: false
  }, (res, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(res);
    } else {
      console.error("Error al calcular ruta:", status);
      alert("No se pudo calcular la ruta (Directions API). Revisa que la API esté habilitada.");
    }
  });
}

function hookControls(){
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("¿Seguro que quieres reiniciar el checklist?")) return;
    stops.forEach(s => checklist[s.nombre] = false);
    saveChecklist();
    renderCards();
    updateMarkerIcons();
  });
  document.getElementById("nextBtn").addEventListener("click", focusNext);
  document.getElementById("startRouteBtn").addEventListener("click", () => {
    // Centrar en el inicio y abrir popup
    const s = stops[0];
    map.panTo({lat:s.lat, lng:s.lng});
    google.maps.event.trigger(s._marker, 'click');
  });
}

function focusNext(){
  const idx = nextIndex();
  if (idx === -1) { alert("¡Ruta completada! 🎉"); return; }
  const s = stops[idx];
  map.panTo({lat: s.lat, lng: s.lng});
  map.setZoom(17);
  google.maps.event.trigger(s._marker, 'click');
  // Scroll a su tarjeta
  const card = document.querySelector(`[data-stop="${CSS.escape(s.nombre)}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function toggleDone(encodedName){
  const name = decodeURIComponent(encodedName);
  checklist[name] = !checklist[name];
  saveChecklist();
  renderCards();
  updateMarkerIcons();
}

function renderCards(){
  const container = document.getElementById("cards");
  container.innerHTML = "";
  stops.forEach((s, i) => {
    const done = checklist[s.nombre];
    const el = document.createElement("article");
    el.className = "card";
    el.setAttribute("data-stop", s.nombre);
    el.innerHTML = `
      <img src="${s.foto}" alt="Foto ${s.nombre}">
      <div class="pad">
        <h3>${i}. ${s.nombre}</h3>
        <p>🍽️ Tapa típica: <strong>${s.tapa}</strong></p>
        <div class="row">
          <button onclick="google.maps.event.trigger(stops[${i}]._marker, 'click')">Ver en mapa</button>
          <button onclick="toggleDone('${encodeURIComponent(s.nombre)}')">${done ? "Desmarcar" : "Marcar hecha"}</button>
        </div>
      </div>
    `;
    if (done) el.style.opacity = .6;
    container.appendChild(el);
  });
}

// === Flags text ===
function updateFlags(){
  const start = stops[0]?.nombre || "Inicio";
  const end = stops[stops.length-1]?.nombre || "Fin";
  document.getElementById("start-flag").textContent = "🏁 " + start;
  document.getElementById("end-flag").textContent = "🏁 " + end;
}

// === Geolocation ===
function startGeolocation(){
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const p = { lat: latitude, lng: longitude };
    if (!userMarker){
      userMarker = new google.maps.Marker({
        position: p, map,
        title: "Tu posición",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2
        }
      });
    } else {
      userMarker.setPosition(p);
    }
  }, err => {
    console.warn("Geoloc error:", err);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
