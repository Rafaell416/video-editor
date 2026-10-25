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
referencias/, musica/, fuentes/, imagenes/, exportados/, .trabajo/. Si hay
videos sueltos, pregunta: "Veo 3 videos aquí. ¿Los muevo a material-crudo?".
Copia ${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md a ./CLAUDE.md si no existe.
Instala el hook de protección en ./.claude/settings.json (merge).

fuentes/ es para que la persona deje sus propias tipografías (descargadas o
copiadas de Google Fonts); normalmente queda vacía hasta que use :estilo.
imagenes/ es para logos, fotos u otros gráficos que quiera superponer en sus
videos (campo "imagenes" del EDL); también queda vacía hasta que la use.

## 6. Perfil

Haz las 5 preguntas de una en una (ver templates/perfil.md). Escribe ./perfil.md.
Copia el estilo base del nicho a ./brand-sheet.md: busca
${CLAUDE_PLUGIN_ROOT}/templates/estilos/<nicho>.md (en minúsculas, sin tildes
ni espacios). Si existe, cópialo con una nota arriba: "Estilo inicial. Para
hacerlo tuyo pide: 'aprende mi estilo de estos videos'". Si el nicho no
coincide con ninguno de los estilos base (gimnasio, nutricion, belleza, coach,
restaurante), no inventes uno: copia ${CLAUDE_PLUGIN_ROOT}/templates/brand-sheet.md
(el genérico) y dilo así: "Todavía no tengo un estilo armado para
'{{nicho}}', así que arrancas con uno neutro. Cuando quieras, dime 'aprende mi
estilo de estos videos' o descríbemelo y lo ajusto".

## 7. Cierre

Di exactamente esto, adaptado al nombre:
"Listo, {{nombre}}. Deja tu video en la carpeta material-crudo y escríbeme:
edita el video que acabo de dejar. Te muestro un borrador antes de terminar."

## 8. Nivel 2 (opcional): HyperFrames

Solo si la persona pide "gráficos animados", "motion graphics", "texto
animado" o "nivel 2" (nunca lo ofrezcas sin que lo pidan: es el 20 % de los
casos y el 80 % de los problemas de instalación).

1. Explica en dos frases qué agrega (títulos y subtítulos animados,
   gráficos) y qué requiere (Chrome, ~10 min de instalación).
2. Si no hay git, instálalo primero (brew/winget, igual que las demás
   herramientas).
3. Instala el plugin oficial:
   claude plugin marketplace add heygen-com/hyperframes
   claude plugin install hyperframes@hyperframes
4. Verifica que /hyperframes responda.
5. Anota en perfil.md: nivel: 2.

No es parte de la instalación base y nunca bloquea nada de lo demás: si
falla, el resto del editor sigue funcionando igual (nivel 1).
