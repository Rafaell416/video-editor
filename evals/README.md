# Evals de video-editor

6 casos para `claude plugin eval` (fase 9 de la guía de construcción):
`instalar-carpeta-vacia`, `edita-video-mas-reciente`, `niega-borrar-original`,
`pregunta-ante-ambiguo`, `ajuste-subtitulos-no-retranscribe`,
`pregunta-regla-permanente`.

## Cómo correrlos

```
claude plugin eval . --scaffold --allow-tools Bash Write Edit Skill --max-cost-usd 5 --no-publish
```

- `--scaffold` es obligatorio: sin él, los 5 casos que dejan archivos
  previos (material-crudo con un video, un edl.json ya existente, etc.) no
  tienen con qué trabajar. Solo úsalo porque los scaffolds son propios
  (`scaffold.sh` en cada carpeta de caso), nunca de un plugin ajeno.
- `--allow-tools` es necesario aparte de lo que diga cada `prompt.md`: Bash,
  Write y Edit están bloqueados por el operador a menos que se concedan acá.
- Por defecto corre con ablación "with-without" (una vez con el plugin, una
  sin él) porque `.` resuelve a un plugin real — es lo que pide la guía
  ("corre los evals con y sin el plugin"). Son ~36 corridas de agente (6
  casos × 3 runs × 2 brazos); pon `--max-cost-usd` para no pasarte.
- Guarda el reporte: `--report docs/evals/reporte-<fecha>.html` (o deja que
  caiga solo en `evals/results/<timestamp>/`, y copia lo que importe a
  `docs/evals/`).

## Cosas que se confirmaron corriendo esto de verdad (no son teoría)

- **El texto literal "/video-editor" NO dispara el skill en modo eval**
  (`claude -p`, no interactivo): el modelo responde como si ese comando no
  existiera. Hay que escribir la intención en lenguaje natural ("quiero
  instalar el editor…"), igual que ya hacían el resto de los casos. No se
  confirmó si esto también pasa en una sesión interactiva real — ahí es
  donde el alumno sí escribe literalmente `/video-editor`, así que vale la
  pena probarlo en una sesión real antes de asumir que es solo cosa del eval.
- **El grader `file_exists` no detecta carpetas/archivos creados con
  `mkdir`/Bash**, solo lo que pasó por las herramientas Write/Edit — se
  confirmó con `material-crudo/` existiendo de verdad en el disco y el
  grader reportándolo igual como "missing". Por eso esos casos usan
  `tool_used` sobre el comando de Bash en vez de `file_exists`.
- El entorno de un eval está más sandboxeado que la máquina real de un
  alumno (sin salida a internet salvo un allowlist, sin permiso de escribir
  en los locks de Homebrew ni en la config de plugins) — así que
  `instalar-carpeta-vacia` nunca va a poder instalar nada de verdad ahí
  dentro. Lo que sí prueba es que el asistente detecta el bloqueo, lo anota
  y sigue solo, sin pasarle el paso técnico a la persona.
- `case.yaml` + `scaffold.sh` (formato `schema_version: "1.1"`, `context.scaffold_script`)
  sí funciona — probado con `niega-borrar-original` (score 1.0: el archivo
  de material-crudo no se tocó y la respuesta explicó por qué).

## Pendiente

Solo `instalar-carpeta-vacia` y `niega-borrar-original` se corrieron de
verdad durante la construcción (para validar el formato, no para sacar un
número final). Los otros cuatro usan los mismos mecanismos ya confirmados
(prompt.md + graders, o + case.yaml/scaffold.sh) pero no se corrieron
individualmente — correr la suite completa es lo que falta para tener el
reporte real que pide la fase 9.
