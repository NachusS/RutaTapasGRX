# Ruta de Tapas por Granada — v6.2

Web-app estática con Google Maps (ruta a pie, geoposición, checklist con LocalStorage, modo oscuro, métricas, ETA, toasts) y soporte offline (Service Worker).

## Novedades v6.2
- Prioridad total a **imágenes locales** `assets/<id>.jpg` y `assets/<id>_tapa.jpg`.
- **ETA** (distancia/tiempo) para la ruta o el siguiente destino.
- **Marcado automático al llegar** (umbral ~35 m) con confirmación vía **toast**.
- **Métricas**: paradas hechas/total, distancia y tiempo total.
- **Service Worker**: cachea estáticos y `stops.json` para modo offline.
- Script `tools/fetch_photos.py` para descargar URLs a `assets/` si lo necesitas.

## Estructura
```
/
├─ index.html
├─ styles.css
├─ app.js
├─ sw.js
├─ data/
│  ├─ stops.json
│  └─ remote_photos.json
├─ assets/
│  ├─ cover.jpg
│  ├─ <id>.jpg         (fachadas; ya incluida: lara.jpg)
│  └─ <id>_tapa.jpg    (tapas; placeholders)
└─ tools/
   └─ fetch_photos.py
```

## Google Maps
1. Crea una **API key** y habilita **Maps JavaScript API** y **Directions API**.
2. Restringe la key a tu dominio (GitHub Pages).
3. Sustituye `YOUR_API_KEY` en `index.html`.

## Imágenes IA
- Guarda tus imágenes IA 1:1 en `assets/` con estos nombres:
  - Fachadas: `lara.jpg`, `mirador-sannicolas.jpg`, ..., `la-tana.jpg`
  - Tapas: `lara_tapa.jpg`, ..., `la-tana_tapa.jpg`
- La app ya está configurada para usarlas automáticamente.

## Publicación en GitHub Pages
- Sube todo el repo a GitHub.
- Settings → Pages → Deploy from a branch → `main` / root.
- Abre la URL de Pages (HTTPS).

