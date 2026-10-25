---
name: ajustar
user-invocable: false
description: Aplica un cambio puntual a la última edición (subtítulos, música, gancho, cortes, zooms, logo, fuente, duración) sin rehacer todo. Úsalo cuando la persona pida cambiar, subir, bajar, quitar, mover o agregar algo a un video ya editado.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*)
model: sonnet
---

Trabaja SOLO sobre .trabajo/<último video>/edl.json y brand-sheet.md.
Nunca vuelvas a transcribir ni a correr cuts.mjs salvo que pidan "vuelve a cortar".

Antes de tocar nada: guarda una copia del edl.json actual como edl.v{n}.json
en la misma carpeta (el siguiente número libre). Es el historial de la
sesión, no el de los videos exportados — nunca lo borres ni lo sobreescribas.

Mapa de peticiones → cambio:
- "subtítulos más grandes/pequeños" → brand-sheet subtitulos.tamano ±20 %
- "música más baja/alta" → edl.musica.volumen ±0.05 (mín 0.05, máx 0.35)
- "quita la música" → edl.musica.archivo = null
- "ponle música" / "agrega música" → si no dijo cuál, mira musica/ y pregunta
  cuál; si no hay ninguna, dilo: "no tengo pistas en musica/, deja un
  archivo ahí (con licencia) y lo uso"; una vez elegida, edl.musica.archivo
  = esa ruta
- "el gancho que diga X" → edl.titulo.texto
- "deja la pausa después de X" → segmento con texto X: siguiente silencio mantener=true
- "usa la primera/segunda toma de X" → intercambia mantener entre repeticiones de X
- "córtalo a N segundos" → propone qué segmentos quitar (los menos informativos) y PREGUNTA antes
- "más/menos zooms" → zooms_por_minuto ±1 y regenera edl.zooms
- "el título tapa mi cara" → titulo posición arriba (posicion_y 0.12)
- "ponle mi logo" / "agrega una imagen" → si no dijo cuál, mira imagenes/ y
  pregunta cuál (o pide que deje el archivo ahí); agrega un elemento a
  edl.imagenes (ver references/edl-schema.md para los campos). Si no dio
  posición o duración, usa arriba-der, ancho 0.2, y toda la duración del video.
- "quita el logo" / "quita la imagen" → edl.imagenes = []
- "cambia la fuente a X" / "usa la tipografía X" → sigue la sección "Fuente
  de marca" de skills/estilo/SKILL.md (busca en fuentes/ y templates/fonts/
  primero; si no está, descárgala con scripts/fonts.mjs); actualiza
  brand-sheet.md con el nombre REAL que te dé el script, no el que escribió
  la persona

Flujo: aplica el cambio en el EDL (o brand-sheet.md) → render.mjs --borrador
→ "Listo, míralo. ¿Lo dejo así?" → con "aprobado" render --final (nueva
versión _v{N}; render.mjs ya guarda una copia del EDL como
exportados/<nombre>_v{N}.edl.json, así que si luego dicen "la versión 1
estaba mejor" puedes volver a renderizar desde ese EDL sin preguntar nada más).

Si el cambio suena permanente ("siempre", "de ahora en adelante", "me gusta
más así"), pregunta: "¿Lo guardo como regla para todos tus videos?". Si sí,
escribe una línea en la sección "Ajustes permanentes" de ./CLAUDE.md o
cambia el brand-sheet, según aplique.
