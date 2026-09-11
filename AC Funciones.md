# Mejoras Visuales y Nuevas Funciones

Planteamiento consolidado para **Video Ranking Editor V2**: agrupa tres frentes de trabajo que están relacionados entre sí — separar la importación de archivos de la edición de clips, sumar imágenes como nuevo tipo de elemento, reorganizar visualmente la interfaz existente, y ampliar la línea de tiempo con capas dedicadas a cada tipo de media.

---
## 1. Nueva función: soporte de imágenes y separación "Clips" / "Media"

Hoy el apartado 🎞️ **Media** mezcla dos cosas: la importación de archivos y la edición individual de cada clip. Se separa en dos pestañas independientes, y se añade la posibilidad de trabajar con **imágenes** además de video.

### Características
- **Pestaña "Clips"** (renombrada desde el actual "Media"): conserva exactamente su función de hoy — edición individual de cada elemento ya agregado al timeline (recorte, orden, Momento Clave, Voz en Off, Diseño de Sonido, subtítulos).
- **Pestaña "Media"** (nueva): zona exclusiva de importación — arrastra archivos, súbelos con el botón, o pega una URL (reutilizando el mismo mecanismo de yt-dlp ya existente). Ahora acepta también **imágenes** (JPG, PNG, WEBP), no solo video.
- **Imágenes como nuevo tipo de clip**:
  - Duración por defecto de **5 segundos** en el timeline, editable libremente por el usuario.
  - Versión "ligera" de un clip: no incluye Momento Clave, Voz en Off, Diseño de Sonido ni subtítulos, pero sí comparte título, numeración y barras con el resto del video.
  - **Soporte de transparencia**: PNG con canal alfa se respeta de forma nativa, sin aplanarse en ningún paso intermedio.
- **Redimensionamiento con handles de esquina**:
  - 4 círculos manejadores en las esquinas de la imagen, **ocultos por defecto** y visibles cuando el cursor pasa por encima de la imagen (no requiere pasar sobre cada círculo individualmente).
  - Escalado **proporcional** (mantiene el aspect ratio original; no se puede deformar).
  - Rango permitido: de ~160px de ancho como mínimo, hasta el 100% del canvas de exportación (1080×1920) como máximo.
  - La imagen **nunca pierde resolución ni calidad** al redimensionar: el cambio es solo de escala de dibujo en el canvas, nunca una recompresión del archivo original.
- **Posicionamiento libre**: la imagen se puede arrastrar por el canvas igual que hoy se arrastran el título y los números, sin restricción — se permite moverla incluso fuera de los límites del canvas.
- **Efecto Fade In / Fade Out**:
  - Dos controles **independientes** entre sí, cada uno ajustable de **0.0 a 1.0 segundos**.
  - **Recálculo automático**: si la suma de ambos supera la duración total de la imagen en pantalla, se ajustan proporcionalmente para no solaparse.
  - La opacidad del fade se combina correctamente (multiplicándose) con la transparencia propia del PNG, en vez de sobrescribirla.

### Modelo de datos propuesto (clip de tipo imagen)

```
{
  type: "image",
  src: <referencia al archivo original en resolución completa>,
  duration: 5,              // segundos, editable, default 5
  position: { x, y },       // arrastre libre, sin restricción
  size: { width, height },  // proporcional, min ~160px, max 1080x1920
  fadeIn: 0.0,              // 0.0 - 1.0s, independiente
  fadeOut: 0.0,             // 0.0 - 1.0s, independiente
  hasTransparency: true     // según canal alfa del PNG
}
```

### Barra de progreso en la interpolación de FPS
- Cuando el servidor local esté **interpolando un clip** (normalización a 60 fps vía `minterpolate`, endpoint `/api/normalize`), debe mostrarse una **barra de progreso debajo del clip** correspondiente, indicando el **porcentaje (%)** de avance en tiempo real.
- Aplica solo a los clips que efectivamente requieren interpolación (24/25/30 fps → 60 fps); los que ya están en 60 CFR no la muestran, ya que no se reprocesan.

---

## 2. Reorganización visual de la interfaz

Hoy toda la configuración vive en un único panel izquierdo de acordeones largos (Barras de color, Barras borrosas, Estilo captions, Overlay Shorts, etc.), todo visible a la vez con scroll dentro de cada pestaña. Se reorganiza en tres zonas: **navegación lateral izquierda** (ya existente, sin agregar íconos nuevos), **canvas central**, y **línea de tiempo simplificada** (ver sección 3).

### Barra de navegación lateral izquierda
Se mantiene exactamente como está hoy: **Media, Textos, Estilo, Estructura, Audio, Efectos, Presets**. No se agregan ni quitan pestañas.
- La única diferencia es en el **contenido de la pestaña "Media"**: en vez de mostrar la edición de cada clip individualmente ahí mismo, esta pestaña pasa a ser la biblioteca de importación descrita abajo (el apartado "My media"). La edición individual de cada clip (recorte, orden, momento clave, etc.) se mantiene disponible como ya la conoces, solo que separada de la vista de importación — esto conecta directamente con la sección 1.
- El resto de pestañas (Textos, Estilo, Estructura, Audio, Efectos, Presets) conservan su contenido y función actuales sin cambios.

### Panel "My media" (biblioteca de importación)
- Grid de miniaturas de los archivos importados (video e imagen), cada una con: **thumbnail**, **duración** (badge tipo "0:29"), **nombre del archivo**, checkbox de selección.
- Botón principal **"Import media"** con flecha desplegable para elegir el método: subir archivo, arrastrar, o pegar URL (TikTok/YouTube/Instagram vía yt-dlp).
- Iconos de orden/filtro sobre el grid.

### Barra superior minimalista
- Izquierda: **Undo / Redo** (nuevo — no existe hoy; se recomienda añadir historial de acciones).
- Derecha: **Share** (dropdown, opcional) + **Export** (ya existente como "Exportar").
- Se elimina la necesidad de mostrar "Guardar/Borrar" de forma permanente en la barra — pueden integrarse como acciones dentro de un menú, o mantenerse si se prefiere no perder ese acceso rápido (a definir).

### Canvas central
- Aumentar el espacio del preview: minimizar el "peso visual" de los paneles laterales.
- Mantener el ícono de **pantalla completa** en la esquina inferior derecha del preview.
- El preview **no puede deformarse de su aspect ratio 9:16 (1080×1920)** bajo ningún caso: al ganar más espacio disponible, debe escalarse proporcionalmente (más grande o más pequeño), nunca estirarse o achatarse.

---

## 3. Línea de tiempo: capas para todo tipo de media

Hoy la línea de tiempo maneja los clips de video en una sola pista y el audio en otra pista compartida entre música, voz en off y SFX (además de una fila de FX con marcadores). Con la llegada de las **imágenes** (sección 1), se necesita una estructura de capas más clara para que cada tipo de contenido tenga su propio espacio visual y no se amontone todo en la misma fila.

### Capas propuestas (de arriba hacia abajo)
1. **Texto / FX** — mantiene los marcadores de eventos que hoy están en la fila "FX" (Momento Clave, Textos en Pantalla, etc.).
2. **Imágenes** — nueva capa exclusiva para los elementos de imagen agregados desde la pestaña "Media". Cada bloque muestra su miniatura, y su fade in/out se puede visualizar como un pequeño degradado en los bordes del bloque.
3. **Video** — la pista de clips de video que ya existe hoy, sin cambios en su función.
4. **Audio — Música** — pista dedicada a la música de fondo.
5. **Audio — Voz en Off** — pista dedicada a los audios de voz IA importados.
6. **Audio — SFX / Sonido** — pista dedicada a golpes de bajo, transiciones y stings (Diseño de Sonido).

*(Las tres últimas hoy están mezcladas en una sola fila "Audio"; separarlas evita que se superpongan visualmente y permite arrastrar/ajustar cada una sin confundirla con las demás.)*

### Por qué separarlas
- Con varios audios en la misma fila (música + voz + SFX), es fácil perder de vista dónde empieza y termina cada uno cuando se solapan en el tiempo.
- Si las imágenes comparten fila con los videos, se vuelve difícil distinguir un clip de video de una imagen de un vistazo — de ahí la capa separada.

### Comportamiento esperado
- Cada capa se comporta igual que las filas actuales: clic y arrastre para navegar, zoom con el slider existente, y los mismos botones de +Audio/Dividir/Borrar ya existentes (adaptados a la capa correspondiente donde aplique).
- Además, en la simplificación de la barra de controles (sección 2), los controles de reproducción (retroceder, loop, avanzar, play, tiempo actual/total) se mueven a una fila **centrada arriba** de la línea de tiempo, en vez de estar a la izquierda como hoy, y el zoom/+Audio/Dividir/Borrar se reubican de forma más discreta (iconos pequeños junto al timeline).
- Las capas de audio (Música/Voz/SFX) deben poder **colapsarse u ocultarse individualmente** si el usuario quiere reducir el ruido visual cuando no las está editando.
- La capa de Imágenes debe reflejar visualmente el fade in/out configurado (un leve degradado de opacidad en los extremos del bloque), para que el usuario vea de un vistazo dónde está el desvanecido sin tener que abrir el panel de edición.

---

## 4. Impacto general en la exportación

- Posición, tamaño, fade y transparencia de las imágenes se ven **exactamente igual** en la previsualización del canvas y en el render final (WebCodecs, con fallback a MediaRecorder/WebM).
- Ninguna de estas funciones (imágenes, reorganización visual, capas del timeline) altera los parámetros de calidad ya existentes del video exportado: mismo bitrate, mismos 60 fps CFR, mismo códec, misma resolución de salida 1080×1920.
