# Mi estilo

Escrito en palabras para mí, y abajo en valores para el editor.

## En palabras
Tono: directo y cercano. Ritmo rápido, cortes secos. Subtítulos grandes y gruesos,
palabra por palabra. Un color de acento para números y palabras clave. Música
suave, nunca por encima de la voz. Nunca: emojis en pantalla, zooms exagerados,
transiciones con efectos.

## Valores (los lee el editor; no cambies los nombres)
```yaml
subtitulos:
  modo: palabra          # palabra | grupo
  fuente: Archivo Black  # debe existir en templates/fonts/
  tamano: 96             # px sobre 1920 de alto
  color: "#FFFFFF"
  acento: "#FFD166"
  borde: "#000000"
  borde_px: 5
  posicion_y: 0.72       # fracción de la altura (0 = arriba)
titulo:
  fuente: Archivo Black
  tamano: 110
  caja: "#000000AA"
ritmo:
  umbral_silencio_s: 0.4
  zoom_factor: 1.15
  zooms_por_minuto: 3
musica:
  estilo: "lo-fi suave"
  volumen: 0.15
nunca:
  - emojis
  - transiciones con efectos
```
