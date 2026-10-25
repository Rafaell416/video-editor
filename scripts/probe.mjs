// Detecta el formato de un video (yap, pantalla, horizontal, montaje) con
// tres señales baratas: relación de aspecto, cuánto cambia la imagen entre
// frames espaciados, y palabras por minuto si ya hay una transcripción.
//
// Uso:
//   node scripts/probe.mjs <video> [--palabras <palabras.json>]
//
// Salida: JSON { formato, confianza, razones[], detalle } a stdout.
//
// Nota: en el flujo normal de :editar, probe.mjs corre ANTES de
// transcribe.mjs (paso 2, antes del paso 3), así que casi siempre NO hay
// palabras.json todavía. Por eso la clasificación tiene que funcionar bien
// solo con aspecto + cambio entre frames; la voz es un refuerzo opcional,
// no un requisito. Cuando falta, la confianza baja y la skill pregunta
// (regla: confianza < 0.7 → preguntar).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { findFfmpeg, findFfprobe } from './lib/paths.mjs';

function parseArgs(argv) {
  const args = { video: null, palabras: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--palabras') args.palabras = argv[++i];
    else if (!args.video) args.video = a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.video) {
  console.error('Uso: node scripts/probe.mjs <video> [--palabras <palabras.json>]');
  process.exit(1);
}
if (!fs.existsSync(args.video)) {
  console.error(`No encuentro el archivo: ${args.video}`);
  process.exit(1);
}

const ffprobe = findFfprobe();
const ffmpeg = findFfmpeg();
if (!ffprobe || !ffmpeg) {
  console.error('ffmpeg/ffprobe no están instalados. Corre /video-editor para instalarlos.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1) Metadata básica: ancho, alto, duración, fps
// ---------------------------------------------------------------------------

const metaRes = spawnSync(
  ffprobe.path,
  [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate',
    '-show_entries', 'format=duration',
    '-of', 'json',
    args.video,
  ],
  { encoding: 'utf8' },
);
if (metaRes.status !== 0) {
  console.error('No pude leer metadata del video con ffprobe.');
  console.error((metaRes.stderr || '').trim().split(/\r?\n/).pop() || '');
  process.exit(1);
}
const meta = JSON.parse(metaRes.stdout);
const stream = meta.streams?.[0] || {};
const ancho = stream.width || 0;
const alto = stream.height || 0;
const duracion = Number(meta.format?.duration || 0);
const [fpsNum, fpsDen] = (stream.r_frame_rate || '30/1').split('/').map(Number);
const fps = fpsDen ? fpsNum / fpsDen : fpsNum;

if (!ancho || !alto || !duracion) {
  console.error('El video no tiene ancho/alto/duración legibles.');
  process.exit(1);
}

const aspecto = alto > ancho * 1.1 ? 'vertical' : ancho > alto * 1.1 ? 'horizontal' : 'cuadrado';

// ---------------------------------------------------------------------------
// 2) Diferencia media entre 10 frames espaciados: cada uno se saca como
// miniatura 64x64 en escala de grises (rawvideo, sin dependencias), y se
// compara con el anterior sumando la diferencia absoluta por píxel.
// ---------------------------------------------------------------------------

const N_FRAMES = 10;
const LADO = 64;
const BYTES_FRAME = LADO * LADO;

function extraerMiniatura(segundo) {
  const res = spawnSync(
    ffmpeg.path,
    [
      '-ss', String(segundo), '-i', args.video,
      '-frames:v', '1',
      '-vf', `scale=${LADO}:${LADO}:flags=fast_bilinear,format=gray`,
      '-f', 'rawvideo',
      '-',
    ],
    { encoding: 'buffer', maxBuffer: 1024 * 1024 },
  );
  if (res.status !== 0 || !res.stdout || res.stdout.length < BYTES_FRAME) return null;
  return res.stdout.subarray(0, BYTES_FRAME);
}

const margen = duracion * 0.05;
const inicio = margen;
const fin = duracion - margen;
const paso = N_FRAMES > 1 ? (fin - inicio) / (N_FRAMES - 1) : 0;

const miniaturas = [];
for (let i = 0; i < N_FRAMES; i++) {
  const t = inicio + paso * i;
  const buf = extraerMiniatura(Math.max(0, t));
  if (buf) miniaturas.push(buf);
}

let cambioFrames = 0;
if (miniaturas.length >= 2) {
  let sumaDiferencias = 0;
  for (let i = 1; i < miniaturas.length; i++) {
    const a = miniaturas[i - 1];
    const b = miniaturas[i];
    let suma = 0;
    for (let p = 0; p < BYTES_FRAME; p++) suma += Math.abs(a[p] - b[p]);
    sumaDiferencias += suma / BYTES_FRAME;
  }
  cambioFrames = sumaDiferencias / (miniaturas.length - 1);
}

// ---------------------------------------------------------------------------
// 3) Palabras por minuto, solo si ya existe una transcripción
// ---------------------------------------------------------------------------

let vozPpm = null;
if (args.palabras && fs.existsSync(args.palabras)) {
  try {
    const { palabras } = JSON.parse(fs.readFileSync(args.palabras, 'utf8'));
    const minutos = duracion / 60;
    if (Array.isArray(palabras) && minutos > 0) vozPpm = palabras.length / minutos;
  } catch {
    // palabras.json inválido o incompleto: se ignora, no es fatal
  }
}

// ---------------------------------------------------------------------------
// 4) Clasificación
// ---------------------------------------------------------------------------

const UMBRAL_CAMBIO_ALTO = 25; // mucho cambio entre frames (pantalla, montaje)
const UMBRAL_CAMBIO_BAJO = 15; // cara/encuadre estable (yap, horizontal)
const UMBRAL_PPM_ALTO = 100;
const UMBRAL_PPM_BAJO = 40;

function clasificar() {
  const razones = [];
  const vertical = aspecto === 'vertical';
  const horizontal = aspecto === 'horizontal';
  const cambiosBruscos = cambioFrames >= UMBRAL_CAMBIO_ALTO;
  const caraEstable = cambioFrames < UMBRAL_CAMBIO_BAJO;
  const vozConocida = vozPpm != null;
  const vozContinua = vozConocida && vozPpm > UMBRAL_PPM_ALTO;
  const vozBaja = vozConocida && vozPpm < UMBRAL_PPM_BAJO;

  // 1) montaje: poca voz (o música) + muchos cambios de frame. Necesita
  // saber la voz, así que solo dispara si ya hay palabras.json.
  if (vozBaja && cambiosBruscos) {
    razones.push(`poca voz (${vozPpm.toFixed(0)} ppm)`, `muchos cambios entre frames (${cambioFrames.toFixed(1)})`);
    return { formato: 'montaje', confianza: 0.85, razones };
  }

  // 2) pantalla: cambios bruscos de frame (apps, scroll, cursor) y encuadre
  // NO estable. No se exige horizontal: una grabación de pantalla de
  // celular es tan vertical como un YAP.
  if (cambiosBruscos && !caraEstable) {
    razones.push(`cambios bruscos entre frames (${cambioFrames.toFixed(1)})`);
    razones.push(vozConocida ? (vozContinua ? 'voz continua' : 'voz poca o nula') : 'voz sin evaluar todavía');
    const confianza = vozConocida ? (vozContinua ? 0.85 : 0.6) : 0.65;
    return { formato: 'pantalla', confianza, razones };
  }

  // 3) yap / horizontal: encuadre estable, se distinguen por aspecto
  if (caraEstable) {
    const formato = vertical ? 'yap' : horizontal ? 'horizontal' : null;
    if (formato) {
      razones.push(aspecto, `encuadre estable (cambio=${cambioFrames.toFixed(1)})`);
      razones.push(vozConocida ? (vozContinua ? 'voz continua' : 'voz no continua') : 'voz sin evaluar todavía');
      const confianza = vozConocida ? (vozContinua ? 0.9 : 0.55) : 0.75;
      return { formato, confianza, razones };
    }
  }

  // sin patrón claro: no adivines con confianza alta
  razones.push(`sin patrón claro (cambio=${cambioFrames.toFixed(1)}, aspecto=${aspecto})`);
  return { formato: vertical ? 'yap' : 'horizontal', confianza: 0.4, razones };
}

const resultado = clasificar();

console.log(
  JSON.stringify(
    {
      ...resultado,
      detalle: { ancho, alto, duracion, fps, aspecto, cambioFrames: Number(cambioFrames.toFixed(2)), vozPpm },
    },
    null,
    2,
  ),
);
