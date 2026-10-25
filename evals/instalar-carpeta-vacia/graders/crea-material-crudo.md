---
type: tool_used
# file_exists solo cuenta archivos creados vía las herramientas Write/Edit,
# no carpetas hechas con "mkdir" por Bash (confirmado corriendo este caso:
# material-crudo existía de verdad en el disco y file_exists igual decía
# "missing"). Por eso se verifica el intento del comando, no el archivo.
tool: Bash
input_match: 'mkdir.*material-crudo'
min: 1
weight: 1
---
