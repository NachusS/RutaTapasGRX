# Ruta de Tapas por Granada (SPA estática)

Web-app minimalista con Google Maps para seguir una ruta de tapas a pie por Granada, con checklist y progreso persistido en LocalStorage.

## Estructura
```
/
├─ index.html
├─ styles.css
├─ app.js
├─ data/stops.json
└─ assets/ (imágenes)
```

## Configuración de Google Maps
1. Crea una API key en Google Cloud Console.
2. Habilita **Maps JavaScript API** y **Directions API**.
3. Restringe la key por *HTTP referrers* a:
   - `https://<tu-usuario>.github.io/*`
   - `https://<tu-usuario>.github.io/granada-tapas-route/*`
4. En `index.html`, sustituye `YOUR_API_KEY` por tu clave.

## Publicación en GitHub Pages
- **Repo**: crea `granada-tapas-route` y sube estos ficheros a la raíz.
- En *Settings → Pages*: selecciona *Build and deployment → Deploy from a branch*, y *Branch: main /(root)*.
- La app quedará disponible en: `https://<tu-usuario>.github.io/granada-tapas-route/`

## Notas
- Las fotos incluidas son *placeholders*.
- Si no concedes permisos de geolocalización, la app sigue funcionando: usa el botón **Siguiente parada**.
- Si la cuota de Directions falla, se dibuja una línea directa como fallback.
