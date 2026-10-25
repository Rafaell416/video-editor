---
name: estilo
user-invocable: false
description: Aprende el estilo de edición de videos de referencia y crea o ajusta el brand-sheet de la persona. Úsalo cuando pida "aprende mi estilo", "quiero que se vea como", "mi brand sheet", o pegue enlaces de reels.
model: opus
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(yt-dlp *)
---

1. Pide 2 a 3 enlaces (o archivos ya en referencias/). Aclara: son para ESTUDIAR
   el estilo, no para reutilizar contenido.
2. Descarga con yt-dlp a referencias/. Si Instagram bloquea, dilo sin drama y ofrece
   dos salidas: grabar la pantalla del teléfono y dejar el archivo en referencias/,
   o describir el estilo con palabras.
3. Para cada referencia: transcribe.mjs --frames (frames cada 1.5 s). Estudia:
   tipografía y color de subtítulos, posición, palabra/grupo, ritmo de corte
   (cortes por minuto), zooms, gráficos, música (energía), estructura del gancho.
4. Escribe ./brand-sheet.md: parte "En palabras" (5-8 líneas) y parte "Valores".
   Que sea SUYO, inspirado, no copia: cambia al menos color de acento y fuente
   respecto a las referencias. Usa solo fuentes que existan en
   ${CLAUDE_PLUGIN_ROOT}/templates/fonts/ (revisa esa carpeta para ver cuáles hay).
   Respeta los nombres de clave del esquema; no inventes campos nuevos.
5. Muéstralo y pregunta si lo aprueba. Si sí, renderiza 10 s del último video
   editado con el nuevo estilo como muestra:
   node scripts/render.mjs .trabajo/<nombre>/edl.json --borrador --muestra 10

## Si la persona no tiene referencias
Describe su estilo con palabras (tono, ritmo, colores) y tradúcelo tú a los
valores del esquema, eligiendo la fuente más cercana de las disponibles.

## Nunca
- No prometas que yt-dlp siempre funciona con Instagram; a veces falla por
  login o bloqueos. Preséntalo como "a veces funciona" y ofrece la alternativa.
- No sobrescribas brand-sheet.md sin mostrar antes qué va a cambiar.
