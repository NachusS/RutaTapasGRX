const LS_KEYS={PROGRESS:"tapas_progress",THEME:"tapas_theme",NEXT:"tapas_nextStopId"};
let map,directionsService,directionsRenderer,userMarker=null,routePolyline=null,markers=new Map(),stops=[],meta=null;
let toastContainer=null;function ensureToastContainer(){if(!toastContainer){toastContainer=document.createElement('div');toastContainer.className='toast-container';document.body.appendChild(toastContainer)}}function showToast({title="",message="",actions=[],timeout=6000}){ensureToastContainer();const el=document.createElement('div');el.className='toast';el.innerHTML=`${title?`<div class="title">${title}</div>`:""}<div class="msg">${message}</div><div class="actions"></div>`;const aE=el.querySelector('.actions');actions.forEach(a=>{const b=document.createElement('button');b.className=a.ghost?'btn btn-ghost':'btn';b.textContent=a.label||'OK';b.addEventListener('click',()=>{try{a.onClick&&a.onClick()}finally{el.remove()}});aE.appendChild(b)});toastContainer.appendChild(el);if(timeout){setTimeout(()=>{el.remove()},timeout)}}
function resolvePhoto(stop){if(stop.photo_local)return stop.photo_local; if(stop.photo)return stop.photo; return "assets/cover.jpg";}
let currentTargetId=null,arrivalPromptShown=false,lastDirections=null;
function setETA(){ /* removed: metrics show totals */ }Dist.: ${dur||"—"} | Tiempo: ${eta||"—"}`}
function extractTotalsFromDirections(r){try{const route=r.routes[0];let m=0,s=0;route.legs.forEach(l=>{m+=(l.distance?.value||0);s+=(l.duration?.value||0)});return{distanceText:(m/1000).toFixed(1)+" km",durationText:Math.round(s/60)+" min"}}catch(e){return{distanceText:"—",durationText:"—"}}}
function haversineMeters(a,b,c,d){const R=6371000,toRad=x=>x*Math.PI/180,Dlat=toRad(c-a),Dlon=toRad(d-b);const A=Math.sin(Dlat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(Dlon/2)**2;return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A))}
function updateMetrics(){try{const p=getProgress(),total=stops.length,done=stops.filter(s=>p[s.id]).length,mS=document.getElementById('mStops'),mD=document.getElementById('mDistance'),mT=document.getElementById('mTime');if(mS)mS.textContent=`Paradas: ${done}/${total}`;if(lastDirections){const t=extractTotalsFromDirections(lastDirections);if(mD)mD.textContent=`Dist. total: ${t.distanceText}`;if(mT)mT.textContent=`Tiempo total: ${t.durationText}`}else{if(mD)mD.textContent=`Dist. total: —`;if(mT)mT.textContent=`Tiempo total: —`}}catch(e){}}
const els={panel:null,progressText:null,progressBar:null,startBtn:null,nextBtn:null,resetBtn:null,themeBtn:null};
/* Ruta oficial del enlace proporcionado */
const FIXED_ROUTE=[
  {id:"puerta-elvira",name:"Puerta de Elvira",lat:37.1821623,lng:-3.5995620},
  {id:"lara",name:"Bar Lara",lat:37.1806927,lng:-3.5971202},
  {id:"mirador-sannicolas",name:"Rest. Mirador de San Nicolás",lat:37.1816258,lng:-3.5926456},
  {id:"aixa",name:"Restaurante Aixa",lat:37.1827297,lng:-3.5931631},
  {id:"ladrillo-ii",name:"Restaurante El Ladrillo II",lat:37.1825490,lng:-3.5919199},
  {id:"aliatar",name:"Bar Aliatar Los Caracoles",lat:37.1826257,lng:-3.5913302},
  {id:"entraiya",name:"La Entraíya",lat:37.1830871,lng:-3.5920931},
  {id:"casa-1899",name:"Restaurante Casa 1899",lat:37.1789929,lng:-3.5897417},
  {id:"ras-cafe",name:"Ras Café Bar",lat:37.1786630,lng:-3.5909029},
  {id:"la-tana",name:"Taberna La Tana",lat:37.1727349,lng:-3.5961166}
];
function routeOfficialUrlItinerary(){
  if(!directionsService||!directionsRenderer)return;
  const origin=new google.maps.LatLng(FIXED_ROUTE[0].lat,FIXED_ROUTE[0].lng);
  const destination=new google.maps.LatLng(FIXED_ROUTE[FIXED_ROUTE.length-1].lat,FIXED_ROUTE[FIXED_ROUTE.length-1].lng);
  const wps=FIXED_ROUTE.slice(1,FIXED_ROUTE.length-1).map(p=>({location:new google.maps.LatLng(p.lat,p.lng),stopover:true}));
  directionsService.route({origin,destination,waypoints:wps,optimizeWaypoints:false,travelMode:google.maps.TravelMode.WALKING},(result,status)=>{
    if(status==="OK"){
      directionsRenderer.setDirections(result);lastDirections=result;const t=extractTotalsFromDirections(result);setETA(t.distanceText,t.durationText,"Ruta oficial");updateMetrics();showToast({title:"Ruta oficial",message:"Se ha cargado la ruta a pie con todas las paradas indicadas.",timeout:4000});
    }else{console.warn("No se pudo trazar la ruta oficial:",status);showToast({title:"Aviso",message:"No se pudo cargar la ruta oficial. Reintenta más tarde.",timeout:4000});}
  });
}
window.initMap=async function initMap(){
  els.panel=document.getElementById('panel');els.progressText=document.getElementById('progressText');els.progressBar=document.getElementById('progressBar');els.startBtn=document.getElementById('startBtn');els.nextBtn=document.getElementById('nextBtn');els.resetBtn=document.getElementById('resetBtn');els.themeBtn=document.getElementById('themeBtn');
  bindUI();const savedTheme=localStorage.getItem(LS_KEYS.THEME)||"light";document.documentElement.setAttribute("data-theme",savedTheme);
  try{const res=await fetch('data/stops.json');const data=await res.json();meta=data.meta;stops=(data.stops||[]).slice().sort((a,b)=>(a.order??999)-(b.order??999));}catch(err){console.error("Error stops.json",err);showToast({title:"Error",message:"No se pudieron cargar las paradas."});return}
  map=new google.maps.Map(document.getElementById('map'),{center:{lat:meta?.start?.lat||37.17855,lng:meta?.start?.lng||-3.60360},zoom:15,mapTypeControl:false,streetViewControl:false});
  directionsService=new google.maps.DirectionsService();directionsRenderer=new google.maps.DirectionsRenderer({suppressMarkers:true});directionsRenderer.setMap(map);
  drawMarkers();drawBasePolyline();renderCards();updateProgressUI();
  routeOfficialUrlItinerary();
  startGeolocationWatch();updateMetrics();
}
function bindUI(){
  document.getElementById('themeBtn').addEventListener('click',()=>{const c=document.documentElement.getAttribute("data-theme")||"light";const n=c==="light"?"dark":"light";document.documentElement.setAttribute("data-theme",n);localStorage.setItem(LS_KEYS.THEME,n)});
  document.getElementById('resetBtn').addEventListener('click',()=>{localStorage.removeItem(LS_KEYS.PROGRESS);localStorage.removeItem(LS_KEYS.NEXT);updateProgressUI();renderCards();updateMetrics()});
  document.getElementById('startBtn').addEventListener('click',()=>{routeOfficialUrlItinerary()});
  document.getElementById('nextBtn').addEventListener('click',()=>{const next=getNextStop();if(next){localStorage.setItem(LS_KEYS.NEXT,next.id);routeToStop(next.id)}else if(meta?.end){drawDirections(meta.end)}});
}
function drawMarkers(){
  markers.clear();
  const info=new google.maps.InfoWindow();
  for(const stop of stops){
    const m=new google.maps.Marker({position:{lat:stop.lat,lng:stop.lng},map,title:stop.name});
    m.addListener('click',()=>{
      const done=isDone(stop.id);
      const html=`<div style="max-width:260px"><strong>${stop.name}</strong><br/><span style="color:#64748b">${stop.tapa||""}</span><br/><div style="margin-top:.4rem;display:flex;gap:.4rem;flex-wrap:wrap"><button data-stop="${stop.id}" class="gm-btn gm-go">Ir</button><button data-stop="${stop.id}" class="gm-btn gm-done">${done?"Desmarcar":"Marcar"}</button></div></div>`;
      info.setContent(html);info.open(map,m);
      setTimeout(()=>{const goBtn=document.querySelector('.gm-btn.gm-go');const doneBtn=document.querySelector('.gm-btn.gm-done');if(goBtn){goBtn.addEventListener('click',()=>routeToStop(stop.id))}if(doneBtn){doneBtn.addEventListener('click',()=>{toggleDone(stop.id);info.close()})}},0);
    });
    markers.set(stop.id,m);
  }
}
function drawBasePolyline(){if(routePolyline){routePolyline.setMap(null);routePolyline=null}const path=stops.map(s=>({lat:s.lat,lng:s.lng}));routePolyline=new google.maps.Polyline({path,geodesic:true,strokeColor:"#34d399",strokeOpacity:0.8,strokeWeight:4});routePolyline.setMap(map);const b=new google.maps.LatLngBounds();for(const s of stops)b.extend(new google.maps.LatLng(s.lat,s.lng));map.fitBounds(b)}
function renderCards(){const p=getProgress();const panel=document.getElementById('panel');panel.innerHTML="";for(const stop of stops){const done=!!p[stop.id];const card=document.createElement('article');card.className="card";const imgSrc=resolvePhoto(stop);card.innerHTML=`<img src="${imgSrc}" alt="Foto de ${stop.name}" loading="lazy" width="160" height="160"/><div class="card-body"><div class="card-title">${stop.order}. ${stop.name}</div><p class="card-sub">Tapa típica: <strong>${stop.tapa||"—"}</strong></p><div class="card-actions"><button class="btn" data-action="go" data-stop="${stop.id}">Ir a esta parada</button><button class="btn btn-ghost" data-action="done" data-stop="${stop.id}">${done?"Desmarcar":"Marcar como hecha"}</button></div></div>`;panel.appendChild(card)}panel.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;const id=btn.getAttribute('data-stop');const action=btn.getAttribute('data-action');if(action==='go'){routeToStop(id);localStorage.setItem(LS_KEYS.NEXT,id)}else if(action==='done'){toggleDone(id)}})}
function routeToStop(id){currentTargetId=id;arrivalPromptShown=false;const stop=stops.find(s=>s.id===id);if(!stop)return;drawDirections({lat:stop.lat,lng:stop.lng});const m=markers.get(id);if(m){map.panTo(m.getPosition());m.setAnimation(google.maps.Animation.DROP);setTimeout(()=>m.setAnimation(null),1000)}}
function drawDirections(dest){if(!dest)return;let origin=null;if(userMarker){origin=userMarker.getPosition()}else if(stops.length){origin=new google.maps.LatLng(stops[0].lat,stops[0].lng)}
  directionsService.route({origin,destination:dest,travelMode:google.maps.TravelMode.WALKING},(result,status)=>{if(status==="OK"){directionsRenderer.setDirections(result);lastDirections=result;const t=extractTotalsFromDirections(result);setETA(t.distanceText,t.durationText,currentTargetId?"Siguiente":"Ruta");updateMetrics()}else{console.warn("Directions API falló:",status)}})}
function startGeolocationWatch(){if(!('geolocation'in navigator)){console.warn("Geolocalización no disponible.");return}navigator.geolocation.watchPosition((pos)=>{const {latitude,longitude}=pos.coords;const latlng=new google.maps.LatLng(latitude,longitude);if(!userMarker){userMarker=new google.maps.Marker({position:latlng,map,title:"Tu posición",icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:"#ef4444",fillOpacity:1,strokeColor:"#7f1d1d",strokeWeight:1.5}})}else{userMarker.setPosition(latlng)}
try{if(currentTargetId){const t=stops.find(s=>s.id===currentTargetId);if(t){const dist=haversineMeters(latitude,longitude,t.lat,t.lng);if(dist<=35&&!arrivalPromptShown){arrivalPromptShown=True;showToast({title:'Llegada',message:`Has llegado a "${t.name}". ¿Marcar esta parada como hecha?`,actions:[{label:'Sí, marcar',onClick:()=>{if(!isDone(currentTargetId))toggleDone(currentTargetId);currentTargetId=null;routeOfficialUrlItinerary()}},{label:'No, luego',ghost:true,onClick:()=>{setTimeout(()=>{arrivalPromptShown=false},15000)}}],timeout:10000})}}}}catch(e){}},(err)=>{console.warn("No se pudo obtener la ubicación:",err.message)},{enableHighAccuracy:true,maximumAge:5000,timeout:10000})}
function getProgress(){try{return JSON.parse(localStorage.getItem(LS_KEYS.PROGRESS))||{}}catch{return{}}}
function setProgress(o){localStorage.setItem(LS_KEYS.PROGRESS,JSON.stringify(o))}
function isDone(id){const p=getProgress();return !!p[id]}
function toggleDone(id){const p=getProgress();const wasNext=getNextStop()?.id===id;p[id]=!p[id];setProgress(p);updateProgressUI();renderCards();updateMetrics()}
function updateProgressUI(){const p=getProgress();const total=stops.length;const done=stops.filter(s=>p[s.id]).length;const pct=total?Math.round((done/total)*100):0;document.getElementById('progressText').textContent=`Progreso: ${done} / ${total}`;document.getElementById('progressBar').style.width=pct+"%"}
function getNextStop(){const p=getProgress();for(const s of stops){if(!p[s.id])return s}return null}
