#!/bin/sh
# Simula que ya se mostró un storyboard y se está esperando aprobación:
# deja el edl.json y el storyboard.html como si :editar ya hubiera llegado
# hasta ahí (sin necesitar varios turnos de conversación).
set -e
mkdir -p material-crudo ".trabajo/prueba-03"
touch material-crudo/prueba-03.mov
cat > ".trabajo/prueba-03/edl.json" <<'EOF'
{
  "version": 1,
  "fuente": "material-crudo/prueba-03.mov",
  "formato": "yap",
  "salida": { "ancho": 1080, "alto": 1920, "fps": 30 },
  "recorte": { "modo": "cara", "anclaX": 0.5 },
  "segmentos": [
    { "id": 1, "in": 0, "out": 5, "texto": "hola, hoy te muestro algo", "mantener": true, "motivo": "" }
  ],
  "titulo": { "texto": "algo interesante", "desde": 0, "hasta": 3 },
  "subtitulos": { "estilo": "brand-sheet" },
  "musica": { "archivo": null, "volumen": 0.15, "ducking": true },
  "zooms": [],
  "imagenes": [],
  "fuentes_extra": {},
  "broll": [],
  "lower_third": null
}
EOF
echo "<html><body>storyboard de prueba</body></html>" > ".trabajo/prueba-03/storyboard.html"
