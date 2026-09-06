# Video Ranking Editor V2

Editor de video ligero para crear contenido de ranking tipo **Top 5 / Top 10** en formato vertical **9:16** (1080×1920), ideal para TikTok, Instagram Reels y YouTube Shorts.

> Se ejecuta con un pequeño servidor local (Node.js) que además permite importar videos pegando su URL.

## ¿Qué hace?

Permite montar un video de ranking a partir de varios clips cortos, con títulos, numeración, subtítulos y barras de color, y exportar el resultado final a 1080×1920.

## Características principales

- **Importación desde URL**: pega un enlace de TikTok (también YouTube, Instagram, etc.) y el video se descarga y aparece como clip, gracias al servidor local con yt-dlp.
- **Endpoints FPS del servidor local** (requieren FFmpeg/FFprobe en el PATH):
  - `POST /api/analyze` — informe por clip: FPS reales, VFR, duplicados, timestamps.
  - `POST /api/normalize?base=<fps>` — aterriza a CFR y/o interpola hasta 60 fps.
  - `POST /api/validate` — veredicto del render final.
- **Importación de clips**: arrastra videos desde el PC al navegador o úsalos mediante el botón de subida.
- **Orden y recorte**: cambia el orden de los clips y define el inicio/fin de cada uno.
- **Recorte visual en timeline**: selecciona un clip y arrastra sus handles laterales para ajustar Trim In/Trim Out en tiempo real, con una duración mínima de 0,5 segundos.
- **Título personalizable**: dos líneas de texto, fuente, tamaño, color y posición arrastrable.
- **Numeración de ranking**: cada clip lleva su número de posición, texto, color y **posición individual arrastrable** en el canvas.
- **Barras de color superior e inferior**: para decorar y dar estilo al video.
- **Subtítulos / captions**:
  - Manuales: añade filas con texto y tiempos.
  - Automáticos: genera subtítulos con **IA (Whisper)** a partir del audio del clip.
- **Estilo de edición (módulos activables/desactivables)**:
  - ❄ **Momento Clave**: congela cualquier clip en el segundo que elijas (botón «⏱ Ahora»), con texto editable encima (ej: «#2 es el MÁS LOCO»), fuente/color/tamaño/outline y posición arrastrable en el canvas.
  - 🎙️ **Voz en Off**: frase corta por clip (contador de máximo 8 palabras) sincronizada al inicio del clip, importando tu audio de voz IA, con offset de ajuste fino (ms) y captions propias (manuales o con 🪄 IA).
  - 🔊 **Diseño de Sonido**: golpe de bajos importable en el remate de cada clip, SFX de transición importable entre clips y sting especial para la revelación del #1; cada uno con toggle y volumen.
  - 📢 **Textos en Pantalla**: titular principal en 0:00 (duración configurable) y pregunta final para generar comentarios (últimos segundos configurables); textos libres, arrastrables y con estilo.
  - 🔔 **Outro / Suscripción**: segmento final con CTA editable manualmente («¡Suscríbete...»), color de fondo/texto/tamaño, voz IA importada y captions automáticas sobre esa voz (🪄 IA).
- **Posicionamiento visual**: arrastra el título, los números (de forma individual o todos juntos) y el propio video sobre el canvas para encuadrarlos.
- **Línea de tiempo interactiva**: adelanta o retrocede por todo el montaje haciendo clic y arrastrando.
- **Persistencia local**: guarda automáticamente el proyecto (incluyendo los archivos de video y audios de voz/SFX) en **IndexedDB**, para que no pierdas el trabajo al cerrar el navegador o el servidor local.
- **Análisis y normalización de FPS (60 CFR)**: el servidor local usa **FFmpeg/FFprobe** para detectar los FPS reales de cada clip por sus PTS (no solo metadatos), VFR, timestamps rotos y frames duplicados (mpdecimate). Los clips de 24/25/30 fps se convierten a 60 FPS con **interpolación de movimiento (minterpolate)** en vez de duplicar frames; los ya a 60 CFR no se reprocesan. Tras exportar, el render se valida automáticamente (60 fps, CFR, duración, duplicados, sync A/V).
- **Exportación**: renderiza el video final a 1080×1920 en formato **MP4 (H.264)** con **WebCodecs** cuando el navegador lo soporta (codificación por hardware, 60 fps constantes, máxima calidad), con fallback automático a **WebM (VP9)** vía MediaRecorder.

## Cómo usarlo

1. Instala las dependencias (solo la primera vez):
   ```
   npm install
   ```
2. Inicia el servidor local:
   ```
   npm start
   ```
3. Abre `http://localhost:3000` en un navegador moderno (Chrome, Edge, Firefox, etc.).
4. Pulsa **Agregar clip** y, dentro de la tarjeta del clip, importa el video de cualquiera de estas formas:
   - Pega una URL de **TikTok / YouTube / Instagram** en el campo **Pega URL de TikTok...** y pulsa **📥 URL**.
   - Arrastra archivos de video sobre la ventana o pulsa **Subir video**.
5. Configura la edición desde el panel izquierdo, organizado en **pestañas por categoría** (estilo editor de video): 🎞️ **Media** (clips), ✏️ **Textos** (título, textos en pantalla, números), 🎨 **Estilo** (barras, captions, overlay Shorts), 🎬 **Estructura** (intro y outro), 🔊 **Audio** (voz en off, sonido, mezclador, censura), ❄️ **Efectos** (momento clave) y 📋 **Presets**. La pestaña activa se recuerda entre sesiones.
6. Previsualiza el resultado en el canvas central (se ajusta automáticamente al espacio disponible).
7. El proyecto se guarda automáticamente en el navegador; también puedes usar 💾 Guardar o 🗑 Borrar en la barra superior.
8. Cuando esté listo, pulsa **📦 Exportar** (barra superior) y espera a que termine la renderización.

## Requisitos

- **Node.js** (para el servidor local que descarga los videos por URL).
- Abre siempre el editor desde `http://localhost:3000` después de ejecutar `npm start`; no uses Live Server ni abras el HTML con doble clic para importar URLs.
- Navegador con soporte para:
  - `HTML5 Canvas`
  - `MediaRecorder`
  - `Web Audio API` (para la transcripción IA)
  - `Web Workers` con módulos ES (para Whisper)
- Para la transcripción automática se descarga el modelo **Whisper tiny** de Xenova (~150 MB la primera vez).

## Estructura del proyecto

```
proyecto-clips/
├── video-ranking-editor.html   # Estructura HTML de la aplicación
├── styles.css                  # Estilos y tema visual
├── script.js                   # Lógica de la aplicación (Canvas, exportación, IA, etc.)
├── server.js                   # Servidor local: estáticos + descarga de videos por URL (yt-dlp)
├── package.json                # Dependencias: express + yt-dlp-exec
├── downloads/                  # Carpeta temporal para las descargas (se vacía sola)
├── README.md                   # Este archivo
└── Nueva carpeta/              # Carpeta vacía actualmente
```

## Notas

- La edición es **client-side**: los videos no se suben a ningún servidor externo. El servidor local solo descarga el video de la URL que le pides y se lo entrega al navegador.
- El binario de **yt-dlp** se instala automáticamente con `npm install` (paquete `yt-dlp-exec`). Si TikTok cambia algo y una descarga falla, actualiza con `npm update yt-dlp-exec`.
- Descarga solo videos propios o con derechos para reutilizarlos.
- El rendimiento de la exportación depende del navegador y del hardware.
- Los modelos de IA se descargan desde `cdn.jsdelivr.net` la primera vez que se usa la función de transcripción.
