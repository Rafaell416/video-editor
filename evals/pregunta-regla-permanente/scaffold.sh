#!/bin/sh
# Simula un video ya editado: edl.json, palabras.json y brand-sheet.md ya
# existen, para que :ajustar no tenga ninguna razón real para volver a
# transcribir ni a cortar.
set -e
mkdir -p material-crudo musica ".trabajo/prueba-04" exportados
touch material-crudo/prueba-04.mov musica/lofi-01.mp3
cat > ".trabajo/prueba-04/edl.json" <<'EOF'
{
  "version": 1,
  "fuente": "material-crudo/prueba-04.mov",
  "formato": "yap",
  "salida": { "ancho": 1080, "alto": 1920, "fps": 30 },
  "recorte": { "modo": "cara", "anclaX": 0.5 },
  "segmentos": [
    { "id": 1, "in": 0, "out": 5, "texto": "hola, hoy te muestro algo", "mantener": true, "motivo": "" }
  ],
  "titulo": { "texto": "algo interesante", "desde": 0, "hasta": 3 },
  "subtitulos": { "estilo": "brand-sheet" },
  "musica": { "archivo": "musica/lofi-01.mp3", "volumen": 0.15, "ducking": true },
  "zooms": [],
  "imagenes": [],
  "fuentes_extra": {},
  "broll": [],
  "lower_third": null
}
EOF
cat > ".trabajo/prueba-04/palabras.json" <<'EOF'
{
  "palabras": [
    { "t0": 0.2, "t1": 0.6, "texto": "hola,", "conf": 0.9 },
    { "t0": 0.7, "t1": 1.0, "texto": "hoy", "conf": 0.9 },
    { "t0": 1.1, "t1": 1.5, "texto": "te", "conf": 0.9 },
    { "t0": 1.6, "t1": 2.1, "texto": "muestro", "conf": 0.9 },
    { "t0": 2.2, "t1": 2.6, "texto": "algo", "conf": 0.9 }
  ],
  "duracion": 5.0,
  "idioma": "es"
}
EOF
cat > brand-sheet.md <<'EOF'
# Mi estilo

## Valores (los lee el editor; no cambies los nombres)
```yaml
subtitulos:
  modo: palabra
  fuente: Arial Black
  tamano: 68
  color: "#FFFFFF"
  acento: "#32A8FC"
  borde: "#000000"
  borde_px: 4
  posicion_y: 0.8
titulo:
  fuente: Arial Black
  tamano: 64
  caja: "#000000AA"
```
EOF
