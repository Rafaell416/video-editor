---
name: editar
user-invocable: false
description: Edita un video de material-crudo y lo convierte en un reel vertical con cortes, subtítulos, gancho y música. Úsalo cuando la persona pida editar, cortar, subtitular o "hacer el reel".
argument-hint: [archivo]
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*)
model: sonnet
---

Lee ./perfil.md y ./brand-sheet.md. Formato = $0 si lo dieron, si no el del perfil.

1. Elige el archivo: $ARGUMENTS, o el más reciente de material-crudo/ si no lo
   dijeron. Si hay varios videos ahí y no está claro cuál es el principal
   (podría haber B-roll de una edición anterior), pregunta en vez de adivinar.
   Confirma en una frase: "Voy a editar prueba-02.mov (3:12)".
2. node scripts/probe.mjs <archivo> → si "confianza" < 0.7, o el formato
   detectado no coincide con el del perfil, pregunta (ver references/formatos.md)
   en vez de seguir. Si el formato no es "yap" (el único con motor de corte
   propio hoy), dilo y pregunta cómo seguir: no lo fuerces por el camino de yap.
3. node scripts/transcribe.mjs <archivo> --frames
4. node scripts/cuts.mjs → edl.json. Lee la transcripción y el EDL. Ajusta SOLO:
   pausas que parezcan intencionales, repeticiones que sean énfasis, y el texto del
   gancho (hazlo concreto y corto). Guarda edl.json.
5. node scripts/storyboard.mjs → abre .trabajo/<nombre>/storyboard.html en el
   panel de navegador. Resume en 3 líneas: duración antes/después, qué quitaste, gancho.
6. ESPERA. No sigas hasta que la persona escriba "aprobado" o pida cambios.
   Si pide cambios → aplica en edl.json y vuelve al paso 5.
7. node scripts/render.mjs edl.json --borrador. Di dónde quedó y sugiere la vía más
   simple para verlo en el teléfono según el sistema: AirDrop en Mac, o "mándatelo
   por WhatsApp" en Windows.
8. Si perfil.hyperframes == si, ofrece: "¿Quieres el título y los subtítulos
   animados?". Si sí, usa las skills de HyperFrames (embedded-captions y
   motion-graphics) SOBRE el borrador ya cortado, nunca sobre
   material-crudo: tu motor ya resolvió cortes y audio, HyperFrames solo
   agrega capas visuales encima. Guarda el resultado como una versión más.
   Si perfil.hyperframes == no (falló su instalación), no menciones esta
   opción.
9. ESPERA "aprobado". Entonces node scripts/render.mjs edl.json --final (o,
   si se usó HyperFrames en el paso 8, la versión final sale de ahí).
10. Cierra: "Listo: exportados/prueba-02_v1.mp4. Si quieres cambiar algo, dímelo
    como se lo dirías a un editor. Para el próximo video abre una sesión nueva."

Nunca muestres el comando ffmpeg salvo que falle. Si un script falla, muestra la
última línea del error en una frase y ofrece /video-editor diagnostico.

## Cómo interpretar la respuesta al storyboard
- Aprobación: "aprobado", "dale", "listo", "me gusta", "perfecto", "sí" → continuar.
- Cambio: cualquier frase que mencione un segmento, tiempo, pausa, toma, gancho,
  título → aplicar al EDL (solo lo que menciona), regenerar storyboard, volver a
  esperar.
- Ambiguo ("mmm", "no sé") → pregunta: "¿Lo renderizo así o quieres cambiar algo?".
- Nunca interpretes silencio como aprobación.
