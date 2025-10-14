# 🧠 Prompt Maestro — RutaTapas MultiRuta v6.3

## 🎯 Objetivo
Desarrollar una **web-app dinámica, moderna y minimalista** que permita recorrer rutas gastronómicas a pie (tapear en distintas paradas) visualizadas sobre un mapa de Google Maps.  
La app debe mostrar las paradas, el progreso del usuario, permitir marcar paradas como completadas, mostrar distancia y tiempo estimados, y permitir la geolocalización en tiempo real.

---

## 🗂️ Estructura del Proyecto

```
/
├── index.html
├── styles.css
├── app.js
├── data/
│   ├── routes.json
│   ├── stops.json
│   └── stops_lorca.json
├── assets/
│   ├── cover.jpg
│   ├── <id>.jpg           (foto de cada bar)
│   └── <id>_tapa.jpg      (foto de la tapa típica)
└── README.md
```

---

## 🧩 Tecnologías y Restricciones

- **Frontend:** HTML5 + CSS3 + JavaScript (ES6+), sin frameworks ni build.
- **Google Maps JavaScript API** (modo WALKING).
- **Geolocation API** para posición del usuario.
- **LocalStorage API** para persistencia local.
- **100% estática**, publicable en GitHub Pages.
- **HTTPS obligatorio** (por Geolocation API).
- **Accesibilidad AA o superior.**
- **Textos en español.**
- Diseño **responsive** con **CSS Grid / Flexbox**.
- Variables CSS (`--bg`, `--fg`, `--brand`, `--accent`) para modo claro/oscuro.

---

## 🎨 Interfaz de Usuario (UX/UI)

### Header (no fijo)
- Logo (`cover.jpg`), título `RutaTapas · [nombre de la ruta]`, versión visible.
- Selector de rutas con etiquetas visibles:
  - Desktop: `Selecciona ruta:` (`.control-label-desktop`)
  - Móvil: `Selecciona ruta:` (`.control-label-mobile`)
- Switch **“Ruta completa”** (desktop y móvil sincronizados).
- Botones:
  - `🌓` modo claro/oscuro.
  - `Reiniciar progreso`.

### Bloque de Progreso
- “Progreso X / Y”.
- Barra de progreso animada.
- Tiempo total estimado + tiempo recorrido.
- Distancia total (km).
- Persistencia automática en LocalStorage.

### Fila de Navegación (móvil)
- Etiqueta `Selecciona ruta:` visible solo en móvil.
- Switch “Ruta completa”.
- Botones “Comenzar ruta” y “Siguiente parada”.

### Mapa
- Centrado en ciudad (`meta.cityCenter` o primera parada).
- Tracking a pie (DirectionsService/DirectionsRenderer).
- Fallback polyline si falla Directions API.
- Marcadores:
  - 📍 Paradas
  - 🏁 Inicio/Fin
  - 👤 Usuario
- InfoWindow único, colores legibles, cierre automático.

### Listado de Paradas
- Tarjetas (`<article class='card'>`):
  - Imagen, nombre, badges “Inicio/Fin”.
  - Tapa típica, dirección.
  - Botones:
    - “Marcar como hecha”.
    - “Ir a esta parada”.
- Opacidad reducida si está completada.
- Foco accesible (Enter/Space abre popup).

### Footer
- Leyenda de iconos.
- Aviso de geolocalización.
- Enlace a política de privacidad.

---

## ⚙️ Lógica de Aplicación (app.js)

1. **Carga inicial**
   - Lee `data/routes.json` con cache-busting y fallback.
   - Estructura esperada:
     ```json
     {
       "routes": [
         { "id": "ruta_grx_v1", "title": "NachusS RutaTapas-GRX v1.0", "file": "data/stops.json" },
         { "id": "ruta_lorca_v1", "title": "Ruta Tapas por Lorca", "file": "data/stops_lorca.json" }
       ]
     }
     ```
   - Si falla, muestra banner rojo con `showDiag()`.

2. **Carga de Paradas**
   - Ordenadas por `order`.
   - Campos: `id`, `name`, `lat`, `lng`, `address`, `tapa`, `photo`.
   - `meta.start` y `meta.end` opcionales.

3. **Mapa y Tracking**
   - Marcadores y polyline con color dinámico (`--brand`).
   - Seguimiento con Directions API (modo WALKING).
   - Polyline segmentado (máx. 25 puntos por chunk).
   - Distancia y tiempo total calculados.
   - Fallback visual si Directions falla.

4. **Geolocalización**
   - `navigator.geolocation.watchPosition()` para posición en tiempo real.
   - Si falla, muestra aviso amigable con `showDiag()`.

5. **Persistencia**
   - `tapas_progress` → progreso de paradas.
   - `tapas_theme` → tema.
   - `tapas_nextStopId` → siguiente parada.
   - `tapas_showFullRoute` → visibilidad del trazado completo.

6. **Eventos y Botones**
   - “Comenzar ruta” → traza hasta el siguiente destino.
   - “Siguiente parada” → avanza automáticamente.
   - “Marcar como hecha” → alterna y guarda progreso.
   - “Reiniciar” → limpia progreso.
   - “Modo oscuro” → alterna y guarda preferencia.
   - “Ruta completa” → alterna visibilidad de polylines (desktop/móvil sincronizados).

---

## 💅 Estilo y Diseño (styles.css)

### Variables principales
```css
:root {
  --bg:#fff; --fg:#1f2937; --muted:#6b7280;
  --card:#f8fafc; --border:#e5e7eb;
  --brand:#2563eb; --accent:#d946ef;
}
html[data-theme='dark'] {
  --bg:#0b0f14; --fg:#e5e7eb;
  --brand:#60a5fa; --accent:#f472b6;
}
```

### Componentes visuales
- Botones redondeados, suaves, con hover.
- Tarjetas con fondo `--card` y borde sutil.
- Barra de progreso con gradiente `--brand → #22c55e`.
- `.control-label` y `.control-label-mobile` resaltadas con borde `1px dashed var(--accent)`.
- Header no fijo (sin `position:sticky`).
- Layout desktop:
  - `#map { height:70vh; }`
  - `#panel { max-height:70vh; border-left:1px solid var(--border); }`

---

## ✅ Criterios de Aceptación

- Carga sin errores de consola.  
- Selector de rutas visible y funcional.  
- Rutas cargadas desde JSON correctamente.  
- Mapa, marcadores y tracking visibles.  
- Progreso persistente tras recarga.  
- InfoWindow único, sin popups acumulados.  
- Geolocalización actualiza posición.  
- Modo oscuro adaptado.  
- Header no fijo (scrolla).  
- Etiqueta “Selecciona ruta:” visible en desktop y móvil.

---

## 🚀 Salida Esperada

- Archivos completos:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `data/routes.json`
  - `assets/cover.jpg`
- Ejecutable directamente abriendo `index.html` o en GitHub Pages.
- Sin dependencias externas ni build.

---

## 📁 Uso del Prompt

Puedes usar esta especificación para recrear la app en otros entornos LLM:

- **OpenAI / ChatGPT / GPT‑5:** copiar el contenido del prompt.  
- **Anthropic / Claude / Gemini:** usar el bloque completo como entrada del usuario.  
- **LlamaIndex / LangChain:** cargarlo como mensaje `"role": "user"`.  
- **OpenAI API (chat/completions):**
  ```bash
  curl https://api.openai.com/v1/chat/completions \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $OPENAI_API_KEY' \
    -d @RutaTapas_Prompt_v6_3.json
  ```
