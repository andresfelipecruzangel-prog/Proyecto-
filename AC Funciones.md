# Nueva función: Separación "Clips" / "Media" + Soporte de Imágenes

Planteamiento funcional para ampliar **Video Ranking Editor V2** con un apartado de importación dedicado y soporte de imágenes (con fade y redimensionamiento) como nuevo tipo de elemento en el timeline.

> Repositorio: https://github.com/andresfelipecruzangel-prog/Proyecto-

## ¿Qué cambia?

Hoy el apartado 🎞️ **Media** mezcla dos cosas: la importación de archivos y la edición individual de cada clip. Se separa en dos pestañas independientes, y se añade la posibilidad de trabajar con **imágenes** además de video.

## Características nuevas

- **Pestaña "Clips"** (renombrada desde el actual "Media"): conserva exactamente su función de hoy — edición individual de cada elemento ya agregado al timeline (recorte, orden, Momento Clave, Voz en Off, Diseño de Sonido, subtítulos).
- **Pestaña "Media"** (nueva): zona exclusiva de importación — arrastra archivos, súbelos con el botón, o pega una URL (reutilizando el mismo mecanismo de yt-dlp ya existente). Ahora acepta también **imágenes** (JPG, PNG, WEBP), no solo video.
- **Imágenes como nuevo tipo de clip**:
  - Duración por defecto de **5 segundos** en el timeline, editable libremente por el usuario.
  - Versión "ligera" de un clip: no incluye Momento Clave, Voz en Off, Diseño de Sonido ni subtítulos, pero sí comparte título, numeración y barras con el resto del video.
  - **Soporte de transparencia**: PNG con canal alfa se respeta de forma nativa, sin aplanarse en ningún paso intermedio.
- **Redimensionamiento con handles de esquina**:
  - 4 círculos manejadores en las esquinas de la imagen, **ocultos por defecto** y visibles solo al pasar el cursor por encima.
  - Escalado **proporcional** (mantiene el aspect ratio original; no se puede deformar).
  - Rango permitido: de ~160px de ancho como mínimo, hasta el 100% del canvas de exportación (1080×1920) como máximo.
  - La imagen **nunca pierde resolución ni calidad** al redimensionar: el cambio es solo de escala de dibujo en el canvas, nunca una recompresión del archivo original.
- **Posicionamiento libre**: la imagen se puede arrastrar por el canvas igual que hoy se arrastran el título y los números.
- **Efecto Fade In / Fade Out**:
  - Dos controles **independientes** entre sí, cada uno ajustable de **0.0 a 1.0 segundos**.
  - **Recálculo automático**: si la suma de ambos supera la duración total de la imagen en pantalla, se ajustan proporcionalmente para no solaparse.
  - La opacidad del fade se combina correctamente (multiplicándose) con la transparencia propia del PNG, en vez de sobrescribirla.

## Barra de progreso en la interpolación de FPS

- Cuando el servidor local esté **interpolando un clip** (normalización a 60 fps vía `minterpolate`, endpoint `/api/normalize`), debe mostrarse una **barra de progreso debajo del clip** correspondiente.
- La barra indica el **porcentaje (%)** de avance del proceso en tiempo real, para que el usuario sepa cuánto falta sin quedarse a ciegas mientras dura la conversión.
- Aplica solo a los clips que efectivamente requieren interpolación (24/25/30 fps → 60 fps); los que ya están en 60 CFR no la muestran, ya que no se reprocesan.

## Impacto en la exportación

- Posición, tamaño, fade y transparencia se ven **exactamente igual** en la previsualización del canvas y en el render final (WebCodecs, con fallback a MediaRecorder/WebM).
- Esta función **no altera en ningún caso** los parámetros de calidad ya existentes del video exportado: mismo bitrate, mismos 60 fps CFR, mismo códec, misma resolución de salida 1080×1920.

## Modelo de datos propuesto (para el clip de tipo imagen)

```
{
  type: "image",
  src: <referencia al archivo original en resolución completa>,
  duration: 5,              // segundos, editable, default 5
  position: { x, y },       // arrastre libre
  size: { width, height },  // proporcional, min ~160px, max 1080x1920
  fadeIn: 0.0,              // 0.0 - 1.0s, independiente
  fadeOut: 0.0,             // 0.0 - 1.0s, independiente
  hasTransparency: true     // según canal alfa del PNG
}
```

## Puntos ya resueltos

- Nombres de pestañas: "Clips" (antes Media) + "Media" (nueva, importación).
- Formatos de imagen soportados: JPG, PNG (con transparencia), WEBP.
- Duración default: 5s, editable.
- Las imágenes no llevan módulos exclusivos de video.
- Fade in/out independientes, 0.0–1.0s, con recálculo si se solapan.
- Redimensionamiento vía 4 handles de esquina, visibles solo on-hover, sin deformar aspect ratio.
- Límites de tamaño: mín. ~160px, máx. 100% del canvas (1080×1920).
- La imagen preserva su resolución original en todo momento.
- La exportación general del video no se ve afectada en calidad.
- Se muestra una barra de progreso (%) debajo del clip mientras se interpola su FPS.

## Puntos abiertos para la implementación

- Si los handles aparecen al pasar el cursor sobre toda la imagen o solo al pasar directamente sobre cada círculo.
- Si se restringe también la posición para evitar arrastrar la imagen completamente fuera del canvas (sugerido, sin decidir aún).