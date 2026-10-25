#!/bin/sh
# Dos archivos en material-crudo/ con distinta fecha de modificación (para
# que "el más reciente" tenga una respuesta inequívoca: prueba-02.mov) y no
# vacíos (0 bytes hace que el agente, con razón, se niegue a editarlos en
# vez de elegir uno — se confirmó corriendo este caso antes de este fix).
# perfil.md y brand-sheet.md ya existen para no activar la rama de
# "todavía no está instalado", que no es lo que este caso prueba.
set -e
mkdir -p material-crudo
dd if=/dev/urandom of=material-crudo/prueba-01.mov bs=1024 count=200 2>/dev/null
sleep 1
dd if=/dev/urandom of=material-crudo/prueba-02.mov bs=1024 count=200 2>/dev/null
cat > perfil.md <<'EOF'
nombre: Prueba
usuario: prueba
formato_por_defecto: yap
nicho: coach
plataforma: instagram
musica_por_defecto: no
idioma_subtitulos: es
umbral_silencio_s: 0.5
respiro_s: 0.15
hyperframes: si
creado: 2026-01-01
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
