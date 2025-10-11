# RutaTapas MultiRuta · v5.9

- Rutas desde `data/routes.json` (usa `id|title` y ficheros tipo `data/stops*.json`).
- Tracking **completo** con chunking de waypoints (WALKING) + distancia total + ETA total.
- Navegación puntual “Comenzar/Siguiente parada” (DirectionsRenderer).
- **InfoWindow único** (no se acumulan popups). Cierra al pinchar en el mapa.
- **Checklist** persistente (botón **Marcar como hecha** corregido y accesible).
- **Dark/Light** con variables CSS (el color de la ruta se adapta al tema).
- **100% estático** para GitHub Pages (HTTPS).

## Publicación
1. Sube todo a `main` y activa GitHub Pages (Deploy from a branch → `main`).
2. Carga por HTTPS. Restringe la API key al dominio.

## Datos
- `data/routes.json` (tu formato):  
  ```json
  {
    "routes": [
      { "id": "ruta_grx_v1", "title": "NachusS RutaTapas-GRX v1.0", "file": "data/stops.json" },
      { "id": "ruta_demo", "title": "Ruta Tapas por Lorca", "file": "data/stops_lorca.json" }
    ]
  }
  ```
- Cada `stops*.json` con `stops[]` ordenados por `order` y (opcional) `meta.start`.
