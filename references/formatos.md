# Reglas de edición por formato

`scripts/probe.mjs` detecta cuál de estos cuatro formatos es un video. El
motor de corte completo (como el de `yap`, en `scripts/cuts.mjs`) hoy solo
existe para `yap`; las reglas de abajo para `pantalla`, `horizontal` y
`montaje` son la referencia para cuando se construya su propio `cuts.mjs`
(o una variante). Mientras tanto, si `probe.mjs` detecta uno de esos tres,
la skill `:editar` debe avisar que ese formato todavía no tiene motor
propio y preguntar cómo seguir, en vez de forzarlo por el camino de `yap`.

## yap (hablar a cámara)
Ver `references/formato-yap.md`. Vertical, un orador, silencios y
repeticiones se cortan agresivo, subtítulos palabra por palabra.

## pantalla (grabación de pantalla)
- **Nunca cortar silencios**: un silencio puede ser a alguien leyendo la
  pantalla o completando una acción, no una pausa de más.
- Subtítulos arriba (la parte de abajo suele tener contenido importante en
  pantalla: barra de navegación, botones).
- Zoom al área de actividad: detectar dónde cambia más la imagen entre
  frames (la misma señal que usa `probe.mjs` para clasificar) y acercar
  ahí en vez de a una cara.
- Salida vertical 9:16 con un recorte que siga la actividad (no un punto
  fijo como en `yap`), o 16:9 completo si la persona lo pide.

## horizontal (YouTube largo)
- Cortar silencios, pero con un umbral más permisivo que `yap`: > 0.8 s (en
  `yap` es 0.5 s por defecto). Una charla de YouTube tolera pausas que un
  reel no.
- Subtítulos abajo, centrados, más pequeños que en `yap` (la pantalla es
  más grande, no hace falta que ocupen tanto).
- Capítulos por tema: a partir de la transcripción, detectar cambios de
  tema y escribir un archivo `capitulos.txt` (formato `00:00 Introducción`,
  uno por línea) para pegar en la descripción de YouTube.
- Sin recorte: la salida mantiene la relación de aspecto original.

## montaje (clips con música, sin transcripción)
- No se transcribe: no hay voz que seguir, el corte se guía por el ritmo
  de la música (detectar pulsos con `ffmpeg ebur128` o un detector simple
  de energía del audio).
- Duración por clip: 0.8 a 2 segundos.
- Transiciones de corte seco (sin efectos), igual filosofía que el resto
  del plugin: nada que no se pueda predecir ni probar.
