// Hook PreToolUse: bloquea cualquier comando Bash que pueda modificar
// material-crudo/. Claude Code lo invoca antes de correr un comando y le
// pasa el evento por stdin como JSON ({ tool_name, tool_input, ... }).
//
// Si detecta riesgo, imprime en stderr y sale con código 2: eso cancela
// el comando y Claude Code le muestra el mensaje al modelo, sin ejecutar
// nada. Si no hay riesgo, sale con 0 y el comando sigue su curso normal.

import fs from 'node:fs';

function leerEvento() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function ultimoArgumento(comando) {
  const partes = comando.trim().split(/\s+/);
  return partes[partes.length - 1] || '';
}

function esRiesgoso(command) {
  if (!/material-crudo/i.test(command)) return false; // no toca la carpeta protegida

  const borra = /(^|[\s;&|])(rm|rmdir|del|erase)\b/i.test(command) || /remove-item/i.test(command);
  const mueve = /(^|[\s;&|])mv\b/i.test(command) || /move-item/i.test(command);
  // rm/mv siempre modifican la carpeta de origen, sin importar a dónde
  // apunte el otro argumento: ya sabemos que material-crudo aparece en
  // el comando, así que alcanza con detectar el verbo.
  if (borra || mueve) return true;

  const destino = ultimoArgumento(command).toLowerCase();

  const copia = /(^|[\s;&|])cp\b/i.test(command) || /copy-item/i.test(command);
  if (copia && destino.includes('material-crudo')) return true; // sobrescribe algo dentro

  const ffmpegSobrescribe = /(^|[\s;&|])ffmpeg\b/i.test(command) && /\s-y\b/.test(command);
  if (ffmpegSobrescribe && destino.includes('material-crudo')) return true; // -y pisa el original

  const redirigeAMaterialCrudo = />{1,2}\s*[^|&;]*material-crudo/i.test(command);
  if (redirigeAMaterialCrudo) return true; // > o >> hacia material-crudo

  return false;
}

const evento = leerEvento();
const command = evento?.tool_input?.command;

if (typeof command === 'string' && esRiesgoso(command)) {
  process.stderr.write('Bloqueado: material-crudo es solo lectura\n');
  process.exit(2);
}

process.exit(0);
