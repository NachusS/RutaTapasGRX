# RutaTapas MultiRuta · v5.0

App estática (GitHub Pages) para rutas de tapas andando en Google Maps (Granada / Lorca).
- **Sin build**: solo `index.html`, `styles.css`, `app.js`, carpeta `data/` y `assets/`.
- **Google Maps JavaScript API** con `DirectionsService` (`WALKING`) y `DirectionsRenderer`.
- **Geolocalización** en tiempo real (`watchPosition`).
- **Checklist persistente** + progreso/ETA y **modo claro/oscuro** con CSS variables.
- **Accesible**: aria-live, roles, foco navegable, contraste AA.

## Estructura
```
/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  ├─ routes.json
│  ├─ stops.json
│  └─ stops_lorca.json
└─ assets/
   └─ cover.jpg (y fotos opcionales por id)
```

## Deploy en GitHub Pages
1. Crea un repositorio y sube estos ficheros a la rama `main`.
2. En Settings → Pages, selecciona **Deploy from a branch** → `main` → `/root`.
3. Asegúrate de que la URL sirve por **HTTPS** (geolocalización lo requiere).
4. Restringe tu API Key de Google Maps a tu dominio.

## Datos
- `data/routes.json` define las rutas disponibles (id, nombre, fichero de paradas y centro ciudad).
- `data/stops.json` y `data/stops_lorca.json` contienen `stops[]` con:
  ```json
  { "id": "bar-xxx", "order": 1, "name": "...", "tapa": "...", "lat": 37.123, "lng": -3.456, "address": "...", "photo": "assets/bar-xxx.jpg" }
  ```

## Persistencia (LocalStorage)
- `tapas_progress`: `{ [stopId]: boolean }`
- `tapas_theme`: `"light" | "dark"`
- `tapas_nextStopId`: `string`
- (opc.) métricas mínimas: `tapas_metric_opens`, `tapas_metric_next`, `tapas_metric_geoerr`

## Notas
- Si `Directions` falla por cuota/red, se activa **fallback polyline** local.
- El mapa se centra en la **primera parada** de la ruta cargada.
- Los botones **Comenzar ruta** y **Siguiente parada** aparecen **debajo del header de progreso** en móvil, tal como se requiere.
