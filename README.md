# Granada Tapas Route – Web App (Static, CSV-driven)

Esta es una **web‑app estática** (solo HTML/CSS/JS, sin build) pensada para desplegarse en **GitHub Pages**. 
Usa **Google Maps JavaScript API** para mostrar el mapa, calcular la ruta a pie con *waypoints* y pintar las paradas desde un CSV.

> 👇 **Qué debes editar antes de publicar**
> 1. Abre `index.html` y reemplaza `YOUR_GOOGLE_MAPS_API_KEY` por tu clave real de Google Maps JavaScript API.
> 2. (Opcional) Añade columnas `Tapa` y `Foto` al CSV `data/ruta_tapas_granada.csv` si quieres indicar la tapa típica y una foto del local.
> 3. (Opcional) Sustituye las imágenes de `images/placeholder.jpg` por fotos reales (guárdalas en `images/` y referencia su ruta en la columna `Foto`).

---

## 📦 Estructura del proyecto

```
granada-tapas-app/
├── index.html
├── styles.css
├── app.js
├── data/
│   └── ruta_tapas_granada.csv    # puntos de la ruta (Nombre, Latitud, Longitud, [Tapa], [Foto])
├── images/
│   └── placeholder.jpg
└── README.md
```

## 🗺️ Formato del CSV (`data/ruta_tapas_granada.csv`)

El fichero mínimo debe tener **exactamente** estas columnas: `Nombre, Latitud, Longitud`  
Puedes añadir de forma opcional: `Tapa, Foto`

Ejemplo:

```csv
Nombre,Latitud,Longitud,Tapa,Foto
"Puerta Elvira (Inicio)",37.17672,-3.59906,,"images/puerta-elvira.jpg"
"Bar Lara",37.18048,-3.59368,"Habas con jamón","images/bar-lara.jpg"
...
"Taberna La Tana (Fin)",37.17562,-3.59978,"Vino + Tosta","images/la-tana.jpg"
```

> Si `Tapa` o `Foto` no están presentes, la app mostrará sugerencias genéricas y una imagen de *placeholder*.

---

## 🚀 Publicación en GitHub Pages (sin errores de *build*)

Este proyecto **no usa JSX ni bundlers**. Funciona como **sitio estático** puro. Pasos:

1. **Crea un repositorio** en GitHub (p.ej. `granada-tapas-app`).  
2. **Sube todos los archivos** de esta carpeta al repositorio (mantén la estructura).  
3. Ve a **Settings → Pages**.
   - En **Build and deployment**, elige **Source: Deploy from a branch**.
   - En **Branch**, selecciona `main` (o `master`) y carpeta **/** (root).
   - Guarda. GitHub generará una URL del estilo: `https://TU_USUARIO.github.io/granada-tapas-app/`.
4. Espera a que aparezca el estado **“Your site is published”** y abre la URL.

### ❗ Paquetes a instalar
**Ninguno.** Al ser sitio estático, GitHub Pages no necesita instalación de paquetes.  
Las dependencias (Papa Parse para CSV) se cargan vía CDN directamente en `index.html`.

### 🔑 Clave de Google Maps
- Activa **Maps JavaScript API** y **Directions API** en Google Cloud Console.
- Crea una **API Key** restringida por **HTTP referrers** (tu dominio de GitHub Pages).
- Edita `index.html` y reemplaza `YOUR_GOOGLE_MAPS_API_KEY`.

> Si prefieres no exponer la clave, tendrías que montar un *proxy* o usar Leaflet + OSM (no Google). Esta plantilla está ya preparada para Google Maps como pediste.

---

## 🧠 Funciones clave de la app

- Carga dinámica del **CSV** (Papa Parse).
- **Ruta a pie** con `DirectionsService` + `DirectionsRenderer` y **waypoints** entre inicio y fin.
- **Marcadores** de cada parada con *popups* (nombre, tapa, foto, botón *Marcar como hecha*).
- **Checklist** persistente en **LocalStorage**, con:
  - Contador *(Completadas / Total)* en el **header**.
  - Botón **Siguiente parada** (salta a la siguiente no completada, centra mapa y abre popup).
  - **Reset** de checklist.
- **Geolocalización** (punto azul) para ver tu posición en la ruta.
- **Modo oscuro** con botón toggle (persistente en LocalStorage).
- **Banderas** de inicio y fin.

---

## 🧭 Consejos si algo falla
- ¿Ves `Build failed with 1 error`? En este repo **no hay build**. Si lo ves, es porque estás usando GitHub Pages con **GitHub Actions** personalizadas. Cambia a **Deploy from a branch** como arriba.  
- ¿Mapa en blanco o error de cuota? Revisa la **API key**, habilita **Maps JavaScript API** y **Directions API**, y comprueba **restricciones de referer**.
- ¿No carga el CSV? Asegura la ruta `data/ruta_tapas_granada.csv` y que el fichero tiene cabeceras correctas (`Nombre, Latitud, Longitud`).

¡A disfrutar de las tapas por Granada!
