---
name: diagnostico
user-invocable: false
description: Recoge toda la información de un problema (sistema, herramientas, último error, logs) en un solo archivo para pedir ayuda. Úsalo cuando algo falle dos veces o la persona pida ayuda.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs *)
model: sonnet
---

1. Corre: node ${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs --json
2. Si existe .trabajo/<último video>/log.txt, lee los últimos 50 renglones.
   Si no existe, no pasa nada: muchos problemas no dejan log propio, el
   error ya está en lo que viste fallar en esta sesión.
3. Escribe ./diagnostico-{{fecha}}.md con:
   - Sistema (de check.mjs: os, arch, shell).
   - Tabla de herramientas (de check.mjs: ffmpeg, ffprobe, whisper, node, git, yt-dlp).
   - Versión del plugin (campo "version" de ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json).
   - perfil.hyperframes (si existe perfil.md).
   - Último comando que falló y su error (de esta sesión, o del log.txt si lo leíste).
   - Nombre y duración del video que se estaba editando, y formato detectado
     (de probe.mjs si corrió).
   SIN rutas personales completas (usa solo el nombre del archivo, no la ruta
   entera del sistema) ni contenido del video (ni transcripción ni fotogramas).
4. Di: "Listo. Manda el archivo diagnostico-{{fecha}}.md al canal del curso
   y te ayudamos."
5. Mientras tanto, revisa references/errores-conocidos.md: si el error
   coincide con uno conocido, dilo en una frase e intenta esa solución antes
   de esperar respuesta del canal.

## Cuándo se activa
- Un mismo comando o paso falla dos veces seguidas.
- La persona pide ayuda directamente ("no funciona", "esto está mal", "ayuda").
- Nunca la actives por una sola falla aislada: primero intenta seguir, y si
  vuelve a fallar, recién ahí corre el diagnóstico.
