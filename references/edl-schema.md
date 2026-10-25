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
