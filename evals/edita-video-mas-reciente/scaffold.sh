#!/bin/sh
# Dos archivos en material-crudo/ con distinta fecha de modificación, para
# que "el más reciente" tenga una respuesta inequívoca (prueba-02.mov).
set -e
mkdir -p material-crudo
touch material-crudo/prueba-01.mov
sleep 1
touch material-crudo/prueba-02.mov
