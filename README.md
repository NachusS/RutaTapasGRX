# RutaTapas MultiRuta · v6.1

- Header no fijo (scrolla en móvil y en escritorio). Más espacio para mapa y tarjetas.
- Rutas desde `data/routes.json` con **carga blindada** (multipath + anticaché), banner de diagnóstico si falla.
- Tracking **completo** (chunked) + **distancia total** + ETA total.
- Navegación puntual “Comenzar/Siguiente parada” (DirectionsRenderer).
- **InfoWindow único** (sin popups acumulados). Cierre al pinchar en el mapa.
- **Checklist** persistente (“Marcar como hecha” corregido y accesible).
- **Dark/Light** con variables CSS (color del trazado adaptado).
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
