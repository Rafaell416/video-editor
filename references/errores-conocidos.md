# Errores conocidos

Tabla que lee `:diagnostico` para intentar la solución más probable antes de
pedir ayuda en el canal del curso. Los marcados "confirmado" se encontraron
de verdad construyendo y probando este plugin; los marcados "de la guía,
sin probar en Windows real" son riesgos conocidos documentados en la fase 9
de la guía de construcción, pendientes de confirmar en una máquina Windows
real (este entorno de desarrollo no tiene una).

## ffmpeg sin subtítulos (falta libass) — confirmado, Mac
**Síntoma:** `render.mjs` o `captions.mjs` fallan con algo como
`No such filter: 'ass'`, o el video final sale sin subtítulos quemados.
**Causa:** el `ffmpeg` normal de Homebrew en Mac excluye libass a propósito.
**Solución:** `brew install ffmpeg-full`. `scripts/lib/paths.mjs` ya detecta
esto solo (`findFfmpeg()`) y usa `ffmpeg-full` si lo encuentra instalado;
si el error persiste, confirma que `ffmpeg-full` esté instalado de verdad.

## Falta el modelo de whisper — confirmado
**Síntoma:** `transcribe.mjs` dice "Falta el modelo de whisper en …".
**Causa:** `whisper-cli` está instalado pero nunca se descargó
`ggml-small.bin` (o `ggml-large-v3-turbo.bin` si se pidió `--calidad alta`).
**Solución:** correr `/video-editor` de nuevo para que `:instalar` lo
descargue (o `hyperframes`/`nivel 2` si el que falta es ese paso).

## PATH sin refrescar después de instalar con winget — de la guía, sin probar en Windows real
**Síntoma:** `check.mjs` sigue reportando una herramienta como faltante
justo después de instalarla con winget.
**Causa:** Windows no siempre actualiza la PATH de una sesión ya abierta.
**Solución:** cerrar y volver a abrir la app de Claude, y seguir con
`/video-editor` (ya está en el paso 3 de `:instalar`).

## Rutas con espacios en el nombre de usuario — de la guía, sin probar en Windows real
**Síntoma:** un comando falla con "archivo no encontrado" aunque el archivo
exista, en una cuenta de Windows cuyo nombre de usuario tiene espacios
(p. ej. `C:\Users\Juan Pérez\...`).
**Nota:** los scripts de este plugin llaman a `spawnSync` con arreglos de
argumentos (nunca arman el comando como un solo string de shell), así que
en teoría no deberían romperse por espacios en la ruta — pero no se probó
en una cuenta real con ese caso. Si aparece, es la primera sospecha.

## Antivirus bloqueando el zip de whisper — de la guía, sin probar en Windows real
**Síntoma:** la descarga o descompresión del zip de whisper.cpp falla o el
ejecutable desaparece después de copiarlo.
**Causa:** algunos antivirus ponen binarios desconocidos en cuarentena.
**Solución:** revisar la cuarentena de Windows Defender (u otro antivirus)
y restaurar el archivo, o agregar una excepción para la carpeta de
`video-editor` en `%LOCALAPPDATA%`.

## Nombres de archivo con tildes o caracteres especiales desde el teléfono — de la guía, sin probar en Windows real
**Síntoma:** un video grabado y transferido desde el teléfono con nombre
como "vídeo final.mov" no se encuentra o falla al procesarlo.
**Solución:** renombrar el archivo sin tildes ni símbolos antes de pedir la
edición (p. ej. "video-final.mov").
