/* RutaTapas · v6.4 — ratings + web/notes + rutas robustas + tracking */
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
if(!("geolocation" in navigator)){ showDiag("Tu navegador no soporta Geolocalización. Usa ‘Siguiente parada’. "); return; }
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
function onGeoError(err){ try{ localStorage.setItem("tapas_metric_geoerr", String(state.metrics.geoErrors + 1)); }catch{}; console.warn("Geolocalización error:", err && (err.message||err.code)); showDiag("No se pudo obtener tu posición. Revisa permisos o usa ‘Siguiente parada’. "); }
function showDiag(msg){
const d=document.createElement('div'); d.className='diag'; d.textContent=msg;
document.body.appendChild(d); setTimeout(()=>d.remove(), 5000);
}