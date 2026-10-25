---
name: instalar
user-invocable: false
description: Prepara este computador para editar videos. Instala y prueba FFmpeg, Whisper y Node, crea las carpetas de trabajo y el perfil de la persona. Se ejecuta solo la primera vez o cuando falte algo.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs *)
model: sonnet
---

Vas a preparar este computador. Explica cada paso en una frase, sin jerga.

## 1. Diagnóstico

Corre: node ${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs --json
Muestra una tabla simple: herramienta · estado (✓/✗) · para qué sirve.

## 2. Instalar lo que falte, de una en una

Usa los comandos que devolvió check.mjs para este sistema. Después de cada
instalación vuelve a correr check.mjs y confirma ✓ antes de seguir.

- Si falta Homebrew (Mac): NO intentes instalarlo tú. Di: "Necesito que pegues
  esto en la Terminal (Ctrl + \`), escribas tu contraseña (no se ve mientras
  escribes) y me digas 'listo'". Muestra el comando. Espera.
- Si una instalación pide permisos en Windows, avisa que aparecerá una ventana
  azul y que debe aceptar.
- Si una instalación falla dos veces, anótalo y sigue con las demás. Al final
  reporta qué quedó pendiente y qué sí se puede hacer sin eso.
- Descarga el modelo ggml-small.bin siempre. Pregunta antes de descargar
  large-v3-turbo (1.6 GB): "¿Quieres mejor calidad de transcripción a cambio
  de 1.6 GB y más tiempo?".

## 3. Si la PATH no se refresca (Windows)

Si check.mjs sigue sin encontrar algo recién instalado, pide cerrar y abrir
la app de Claude, y continuar con /video-editor.

## 4. Continúa con la parte 2 (carpetas y perfil) — ver más abajo.

## 5. Carpetas

Si la carpeta actual está vacía o solo tiene videos sueltos: crea material-crudo/,
referencias/, musica/, exportados/, .trabajo/. Si hay videos sueltos, pregunta:
"Veo 3 videos aquí. ¿Los muevo a material-crudo?".
Copia ${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md a ./CLAUDE.md si no existe.
Instala el hook de protección en ./.claude/settings.json (merge).

## 6. Perfil

Haz las 5 preguntas de una en una (ver templates/perfil.md). Escribe ./perfil.md.
Copia el estilo base del nicho a ./brand-sheet.md con una nota arriba:
"Estilo inicial. Para hacerlo tuyo pide: 'aprende mi estilo de estos videos'".

## 7. Cierre

Di exactamente esto, adaptado al nombre:
"Listo, {{nombre}}. Deja tu video en la carpeta material-crudo y escríbeme:
edita el video que acabo de dejar. Te muestro un borrador antes de terminar."
