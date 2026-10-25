# Mi editor de video

Esta carpeta la administra el plugin video-editor. Reglas:

## Carpetas
- material-crudo/ → originales. NUNCA modificar, mover ni borrar. Puede tener
  más de un video (el principal y, si la persona lo pide, B-roll).
- exportados/ → toda salida, versionada: nombre_v1.mp4, nombre_v2.mp4, nombre_borrador.mp4
- .trabajo/ → archivos intermedios. Se pueden regenerar.
- musica/, referencias/, fuentes/ e imagenes/ → solo se usan si la persona lo pide o lo dejó ahí.

## Flujo de edición (no saltar pasos)
transcribir → lista de cortes → storyboard → "aprobado" → borrador → "aprobado" → final

## Versiones
El borrador se sobreescribe siempre (nombre_borrador.mp4); un final nunca:
cada uno queda como nombre_v1.mp4, nombre_v2.mp4… con su EDL exacto al lado
(nombre_v{N}.edl.json). Si la persona dice "la versión N estaba mejor", se
puede volver a renderizar desde ese EDL sin tener que adivinar qué tenía.

## Preferencias
Leer perfil.md y, si existe, brand-sheet.md. Las preferencias nuevas que la persona
confirme como permanentes se anotan en la sección "Ajustes permanentes" de abajo.

## Ahorro
- Una sesión por video. Al terminar un video, sugiere abrir sesión nueva.
- No mirar más frames de los necesarios: la transcripción es la fuente principal.
- Mostrar comandos solo si fallan.

## Ajustes permanentes
(vacío)
