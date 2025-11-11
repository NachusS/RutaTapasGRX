# RutaTapas MultiRuta · v6.5.2

- Etiqueta **“Selecciona ruta:”** visible en escritorio, **y también en móvil** (debajo del progreso, junto al switch y los botones).
- Carga robusta de `data/routes.json` (anticaché + multipath) con diagnóstico visual si falla.
- Header no fijo (desaparece al hacer scroll).
- Tracking **completo** (chunked) + **distancia total** + ETA total.
- Navegación “Comenzar/Siguiente parada” con DirectionsRenderer.
- **InfoWindow único** sin popups acumulados (cierra al pinchar en el mapa).
- **Checklist** persistente (“Marcar como hecha” corregido y accesible).
- Modo **Dark/Light** con color de trazado adaptado.
- Switch **“Ruta completa”** sincronizado (desktop/móvil), persistido.
- 100% estático, listo para **GitHub Pages** (HTTPS).

## Publicación
1. Sube todo el contenido a tu repositorio (rama `main`) y activa GitHub Pages.
2. Asegúrate de servir por **HTTPS** y restringe la API key al dominio de Pages.

## Datos
Ejemplo de `data/routes.json`:
```json
{
  "routes": [
    { "id": "ruta_grx_v1", "title": "NachusS RutaTapas-GRX v1.0", "file": "data/stops.json" },
    { "id": "ruta_lorca_v1", "title": "Ruta Tapas por Lorca", "file": "data/stops_lorca.json" }
  ]
}
```
