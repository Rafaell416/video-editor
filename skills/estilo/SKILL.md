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
3. Para cada referencia: transcribe.mjs --frames (frames cada 1.5 s). Con las
   fotos puedes ver de verdad: tipografía y color de subtítulos, posición,
   palabra/grupo, ritmo de corte (cortes por minuto, calculado de los tiempos
   de palabras.json), zooms entre frames consecutivos, gráficos en pantalla,
   estructura del gancho (primeros 3 s de la transcripción). La música NO la
   puedes escuchar — no la "analices", pregúntale a la persona cómo es
   ("¿tranquila o con ritmo?") o descríbela en términos generales a partir
   del tipo de contenido.
4. Define la tipografía (ver sección "Fuente de marca" abajo) y escribe
   ./brand-sheet.md: parte "En palabras" (5-8 líneas) y parte "Valores". Que
   sea SUYO, inspirado, no copia: cambia al menos color de acento y fuente
   respecto a las referencias. Respeta los nombres de clave del esquema; no
   inventes campos nuevos.
5. Muéstralo y pregunta si lo aprueba. Si sí, renderiza 10 s del último video
   editado con el nuevo estilo como muestra:
   node scripts/render.mjs .trabajo/<nombre>/edl.json --borrador --muestra 10

## Fuente de marca
Las fuentes disponibles viven en ${CLAUDE_PLUGIN_ROOT}/templates/fonts/ (las
que trae el plugin) y en ./fuentes/ (las propias de la persona). Para elegir
una fuente nueva, en este orden:

1. Si ya hay algo parecido en esas dos carpetas, úsalo.
2. Si la persona nombra una fuente de Google Fonts (o tú eliges una que
   encaje con su estilo), descárgala tú mismo:
   node scripts/fonts.mjs "<nombre de la familia>" --peso Black --destino fuentes
   El script imprime el nombre REAL que hay que poner en brand-sheet.md (puede
   no ser idéntico al que escribiste si el peso cambia el nombre, p. ej.
   "Poppins" con --peso Black da "Poppins Black"). Usa siempre ese nombre tal
   cual, no el que tú escribiste a mano.
3. Si la fuente que quiere no está en Google Fonts (una tipografía de marca
   comprada, por ejemplo), explícale cómo conseguirla ella misma:
   "Entra a fonts.google.com, busca el estilo que te guste, abre la fuente,
   dale a 'Download family', descomprime el zip y arrastra el archivo .ttf u
   .otf a la carpeta fuentes/ de este proyecto. Avísame cuando esté y la uso."
   Para una fuente que no es de Google Fonts, pide que copie el archivo
   .ttf/.otf directamente a fuentes/ (nunca un .zip, nunca una URL).
4. Tras instalar o recibir un archivo nuevo, vuelve a escribir fuente en el
   brand sheet con el nombre real (node scripts/fonts.mjs ya te lo da; para un
   archivo que te pegó la persona, puedes leer el nombre real con
   node -e "import('${CLAUDE_PLUGIN_ROOT}/scripts/lib/fonts.mjs").then(m=>console.log(m.leerNombreFamilia(process.argv[1])))" <ruta>).
5. Prefiere SIEMPRE un peso que exista como archivo estático (p. ej.
   Poppins-Black.ttf) sobre una fuente variable: si solo existe variable
   (como pasa con algunas familias en Google Fonts), solo el peso por
   defecto (normalmente Regular) se ve bien; no prometas otros pesos de esa
   familia.

## Si la persona no tiene referencias
Describe su estilo con palabras (tono, ritmo, colores) y tradúcelo tú a los
valores del esquema, eligiendo o descargando la fuente que más se le parezca.

## Nunca
- No prometas que yt-dlp siempre funciona con Instagram; a veces falla por
  login o bloqueos. Preséntalo como "a veces funciona" y ofrece la alternativa.
- No sobrescribas brand-sheet.md sin mostrar antes qué va a cambiar.
- No digas que "escuchaste" o "analizaste" la música de una referencia: no
  puedes oír audio, solo verlo en fotogramas y leer la transcripción.
