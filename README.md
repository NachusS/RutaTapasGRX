# RutaTapas MultiRuta · v6.0

- Rutas desde `data/routes.json` con **carga blindada** (múltiples rutas relativas + anticaché), muestra diagnóstico si falla.
- Tracking **completo** con chunking (WALKING) + **distancia total** + ETA total.
- Navegación puntual “Comenzar/Siguiente parada” (DirectionsRenderer).
- **InfoWindow único** (no se acumulan popups). Cierra al pinchar en el mapa.
- **Checklist** persistente (botón **Marcar como hecha** corregido y accesible).
- **Dark/Light** con variables CSS (el color de la ruta se adapta al tema).
- **Switch “Ruta completa”** sincronizado (desktop/móvil), persistido.
- **100% estático** para GitHub Pages (HTTPS).

## Publicación
1. Sube todo a `main` y activa GitHub Pages (Deploy from a branch → `main`).
2. Carga por **HTTPS**. Restringe la API key al dominio.

## Datos
- `data/routes.json` (tu formato), ejemplo:
  ```json
  {
    "routes": [
      { "id": "ruta_grx_v1", "title": "NachusS RutaTapas-GRX v1.0", "file": "data/stops.json" },
      { "id": "ruta_lorca_v1", "title": "Ruta Tapas por Lorca", "file": "data/stops_lorca.json" }
    ]
  }
  ```
- `stops*.json` con `stops[]` (order, name, lat, lng, address, tapa, photo opc.) y opcional `meta.start`.
