# Esquema del EDL (Edit Decision List)

```json
{
  "version": 1,
  "fuente": "material-crudo/prueba-02.mov",
  "formato": "yap",
  "salida": { "ancho": 1080, "alto": 1920, "fps": 30 },
  "recorte": { "modo": "cara", "anclaX": 0.5 },          // o "centro"
  "segmentos": [
    { "id": 1, "in": 0.42, "out": 3.91, "texto": "hola, hoy te muestro…",
      "mantener": true,  "motivo": "gancho" },
    { "id": 2, "in": 3.91, "out": 5.30, "texto": "",
      "mantener": false, "motivo": "silencio 1.4 s" },
    { "id": 3, "in": 5.30, "out": 9.80, "texto": "primero abre la app…",
      "mantener": false, "motivo": "toma repetida; se queda la #4" },
    { "id": 4, "in": 10.1, "out": 14.6, "texto": "primero abre la app…",
      "mantener": true,  "motivo": "" }
  ],
  "titulo":    { "texto": "3 pasos para…", "desde": 0, "hasta": 3 },
  "subtitulos":{ "modo": "palabra", "estilo": "brand-sheet" },
  "musica":    { "archivo": "musica/lofi-01.mp3", "volumen": 0.15, "ducking": true },
  "zooms":     [ { "en": 12.4, "factor": 1.15, "duracion": 2.0 } ],
  "imagenes":  [ { "archivo": "imagenes/logo.png", "en": 0.5, "duracion": 3.0,
                    "posicion": "arriba-der", "ancho": 0.2 } ],
  "fuentes_extra": { "b1": "material-crudo/broll-cocina.mp4" },
  "broll": [ { "fuente": "b1", "in": 2.0, "desde": 8.0,
               "duracion": 3.5, "audio": "original" } ],
  "lower_third": { "texto": "@usuario", "desde": 1, "hasta": 4 }
}
```

Reglas:
- `in`/`out` son segundos del archivo FUENTE. Los tiempos de título, zooms,
  imágenes y lower_third son segundos del RESULTADO (después de cortes).
- Todo segmento tiene `motivo` cuando `mantener=false`. El storyboard lo muestra.
- Los scripts nunca modifican `segmentos` que ya están en el EDL; solo Claude
  (vía `:ajustar`) lo hace, y siempre guarda una copia `edl.v{n}.json`.
- `imagenes` nunca se llena sola: cuts.mjs siempre la deja en `[]`. Solo se
  agrega un elemento cuando la persona pide explícitamente poner un logo,
  foto o gráfico. `archivo` es una ruta a imagenes/ (o cualquier ruta que
  exista); `ancho` es una fracción del ancho del video (0 a 1); `posicion`
  es una de `arriba-izq`, `arriba-der`, `abajo-izq`, `abajo-der`, `centro`
  (por defecto `arriba-der`). Si el archivo no existe al renderizar, se
  omite sin romper el render (se avisa en la consola, no al alumno salvo
  que pregunte).
- `broll` tampoco se llena sola, y no toca `segmentos` ni los tiempos de
  corte: es una capa de video que reemplaza la imagen (y, según `audio`,
  también el sonido) durante una ventana del RESULTADO, mientras el resto
  de la edición (cortes, subtítulos, música) sigue exactamente igual.
  `fuente` es un alias que debe existir en `fuentes_extra` (así el mismo
  archivo de B-roll se puede reusar en varias ventanas sin repetir la
  ruta). `in` es el segundo DENTRO del clip de B-roll donde empieza a
  tomarse (sin "out": siempre se usan exactamente `duracion` segundos desde
  ahí, para que nunca puedan contradecirse); `desde`/`duracion` son
  segundos del RESULTADO, igual que zooms/imágenes/título.
  `audio` es `"original"` (la voz sigue, el B-roll es mudo — el caso más
  común), `"broll"` (se usa el audio del B-roll, la voz se silencia esa
  ventana) o `"silencio"` (se silencia esa ventana sin meter audio nuevo).
  Si `fuente` no está en `fuentes_extra`, o el archivo no existe, el
  elemento se omite sin romper el render.
