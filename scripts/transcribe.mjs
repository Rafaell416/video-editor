// Transcribe el audio de un video con whisper-cli y normaliza el resultado
// a palabras con tiempos: { palabras: [{ t0, t1, texto, conf }], duracion, idioma }.
//
// Uso:
//   node scripts/transcribe.mjs <video> [--out <ruta>] [--idioma es]
//                                [--calidad alta] [--frames]
//
// Salida: el JSON normalizado a stdout. Progreso ("Transcribiendo… 40 %") a stderr.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findWhisper, findFfmpeg, rutaModelo } from './lib/paths.mjs';

function parseArgs(argv) {
  const args = { video: null, out: null, idioma: 'es', calidad: 'normal', frames: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--idioma') args.idioma = argv[++i];
    else if (a === '--calidad') args.calidad = argv[++i];
    else if (a === '--frames') args.frames = true;
    else if (!args.video) args.video = a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.video) {
  console.error('Uso: node scripts/transcribe.mjs <video> [--out <ruta>] [--idioma es] [--calidad alta] [--frames]');
  process.exit(1);
}
if (!fs.existsSync(args.video)) {
  console.error(`No encuentro el archivo: ${args.video}`);
  process.exit(1);
}

const nombre = path.basename(args.video, path.extname(args.video));
const outDir = path.dirname(args.out || path.join('.trabajo', nombre, 'palabras.json'));
const outFile = args.out || path.join(outDir, 'palabras.json');
fs.mkdirSync(outDir, { recursive: true });

const ffmpeg = findFfmpeg();
if (!ffmpeg) {
  console.error('ffmpeg no está instalado. Corre /video-editor para instalarlo.');
  process.exit(1);
}
const whisper = findWhisper();
if (!whisper) {
  console.error('whisper-cli no está instalado. Corre /video-editor para instalarlo.');
  process.exit(1);
}

let modelo = rutaModelo('ggml-small.bin');
if (args.calidad === 'alta') {
  const grande = rutaModelo('ggml-large-v3-turbo.bin');
  if (fs.existsSync(grande)) modelo = grande;
  else console.error('No encontré ggml-large-v3-turbo.bin, sigo con el modelo small.');
}
if (!fs.existsSync(modelo)) {
  console.error(`Falta el modelo de whisper en ${modelo}. Corre /video-editor para descargarlo.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Paso 1: extraer wav mono 16 kHz en un archivo temporal
// ---------------------------------------------------------------------------

console.error('Transcribiendo… 0 %');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-editor-transcribe-'));
const wav = path.join(tmpDir, 'audio.wav');

const extraccion = spawnSync(
  ffmpeg.path,
  ['-y', '-i', args.video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wav],
  { encoding: 'utf8' },
);
if (extraccion.status !== 0 || !fs.existsSync(wav)) {
  console.error('No pude extraer el audio del video.');
  console.error((extraccion.stderr || '').trim().split(/\r?\n/).pop() || '');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Paso 2: whisper-cli con tiempos por palabra (-ml 1 -sow) y probabilidades
// por token (-ojf) para estimar una confianza por palabra.
// ---------------------------------------------------------------------------

const prefijoSalida = path.join(tmpDir, 'whisper');
const whisperProc = spawnSync(
  whisper.path,
  [
    '-m', modelo,
    '-f', wav,
    '-l', args.idioma,
    '-ml', '1',
    '-sow',
    '-oj', '-ojf',
    '-of', prefijoSalida,
    '-np', '-pp',
  ],
  { encoding: 'utf8', timeout: 10 * 60_000 },
);

for (const linea of (whisperProc.stderr || '').split(/\r?\n/)) {
  const m = linea.match(/progress\s*=\s*(\d+)%/);
  if (m) console.error(`Transcribiendo… ${m[1]} %`);
}

const whisperJsonPath = `${prefijoSalida}.json`;
if (whisperProc.status !== 0 || !fs.existsSync(whisperJsonPath)) {
  console.error('whisper-cli no terminó correctamente.');
  console.error((whisperProc.stderr || '').trim().split(/\r?\n/).pop() || '');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Paso 3: normalizar a { palabras: [{ t0, t1, texto, conf }], duracion, idioma }
// ---------------------------------------------------------------------------

const crudo = JSON.parse(fs.readFileSync(whisperJsonPath, 'utf8'));
const entradas = crudo.transcription || [];

const palabras = entradas
  .map((entrada) => {
    const texto = (entrada.text || '').trim();
    if (!texto) return null;
    const t0 = entrada.offsets.from / 1000;
    const t1 = entrada.offsets.to / 1000;
    const probs = (entrada.tokens || []).map((t) => t.p).filter((p) => typeof p === 'number');
    const conf = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null;
    return { t0, t1, texto, conf };
  })
  .filter(Boolean);

const duracion = palabras.length ? palabras[palabras.length - 1].t1 : 0;

const resultado = {
  palabras,
  duracion,
  idioma: crudo.result?.language || args.idioma,
};

// ---------------------------------------------------------------------------
// Paso 4 (opcional): 1 frame cada 2.5 s a 480 px de ancho, para el storyboard
// ---------------------------------------------------------------------------

if (args.frames) {
  const framesDir = path.join(outDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  spawnSync(
    ffmpeg.path,
    ['-y', '-i', args.video, '-vf', 'fps=1/2.5,scale=480:-1', path.join(framesDir, 'frame_%04d.jpg')],
    { encoding: 'utf8' },
  );
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(resultado, null, 2));
fs.rmSync(tmpDir, { recursive: true, force: true });

console.error(`Transcribiendo… 100 % (${palabras.length} palabras, ${duracion.toFixed(1)} s)`);
console.log(JSON.stringify(resultado, null, 2));
