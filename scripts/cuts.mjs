// A partir de palabras.json y el video fuente (más perfil.md si existe)
// propone qué cortar: silencios, tomas repetidas y muletillas aisladas.
// Escribe el EDL (references/edl-schema.md) y un resumen a stderr.
//
// Uso:
//   node scripts/cuts.mjs <palabras.json> --fuente <video> [--out <edl.json>]
//
// Nota: los silencios se detectan con ffmpeg (silencedetect) sobre el audio
// real, no con los huecos entre t0/t1 de whisper. Probado con audio real:
// whisper-cli, en modo palabra por palabra (-ml 1 -sow), no deja un hueco
// fiable entre palabras aunque haya segundos de silencio real (estira el
// final de la palabra anterior en vez de dejar t1/t0 separados), así que
// ese dato no sirve para medir silencios. El t0 (inicio) de cada palabra sí
// es confiable y es lo que se usa para decidir a qué segmento pertenece.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findFfmpeg } from './lib/paths.mjs';

const MULETILLAS = ['eh', 'este', 'o sea', 'bueno'];
const MIN_RESPIRO_SOBRANTE = 0.05; // si el hueco apenas alcanza para el respiro, no se corta
const UMBRAL_MULETILLA = 0.2;
const RUIDO_SILENCIO_DB = -30; // silencedetect: por debajo de esto se considera silencio

function parseArgs(argv) {
  const args = { palabrasPath: null, fuente: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fuente') args.fuente = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (!args.palabrasPath) args.palabrasPath = a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.palabrasPath || !args.fuente) {
  console.error('Uso: node scripts/cuts.mjs <palabras.json> --fuente <video> [--out <edl.json>]');
  process.exit(1);
}
if (!fs.existsSync(args.fuente)) {
  console.error(`No encuentro el video fuente: ${args.fuente}`);
  process.exit(1);
}

const { palabras, duracion } = JSON.parse(fs.readFileSync(args.palabrasPath, 'utf8'));
const outFile = args.out || path.join(path.dirname(args.palabrasPath), 'edl.json');

// ---------------------------------------------------------------------------
// Perfil: umbral de silencio y respiro (si no hay perfil.md, valores por defecto)
// ---------------------------------------------------------------------------

function leerPerfil() {
  const defaults = { umbral_silencio_s: 0.5, respiro_s: 0.15 };
  if (!fs.existsSync('perfil.md')) return defaults;
  const texto = fs.readFileSync('perfil.md', 'utf8');
  const umbral = texto.match(/^umbral_silencio_s:\s*([\d.]+)/m);
  const respiro = texto.match(/^respiro_s:\s*([\d.]+)/m);
  return {
    umbral_silencio_s: umbral ? Number(umbral[1]) : defaults.umbral_silencio_s,
    respiro_s: respiro ? Number(respiro[1]) : defaults.respiro_s,
  };
}

const { umbral_silencio_s, respiro_s } = leerPerfil();

// ---------------------------------------------------------------------------
// Silencios reales: ffmpeg silencedetect sobre el audio del video fuente.
// Se usa el umbral más fino (el de muletillas) para no perder pausas cortas;
// luego cada uso (corte grande vs. muletilla) aplica su propio umbral.
// ---------------------------------------------------------------------------

function detectarSilencios(rutaFuente, duracionMinima) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error('ffmpeg no está instalado, no puedo detectar silencios.');
    process.exit(1);
  }
  const res = spawnSync(
    ffmpeg.path,
    ['-i', rutaFuente, '-af', `silencedetect=noise=${RUIDO_SILENCIO_DB}dB:d=${duracionMinima}`, '-f', 'null', '-'],
    { encoding: 'utf8', timeout: 5 * 60_000 },
  );
  const salida = res.stderr || '';
  const starts = [...salida.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...salida.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const silencios = [];
  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    silencios.push({ start: starts[i], end: ends[i], duracion: ends[i] - starts[i] });
  }
  return silencios;
}

const silenciosDetectados = detectarSilencios(args.fuente, Math.min(UMBRAL_MULETILLA, umbral_silencio_s));

// ---------------------------------------------------------------------------
// 1) Silencios "grandes": se recortan dejando respiro_s a cada lado.
//    Nunca cortan dentro de una palabra (se ajustan al t0 de la palabra
//    siguiente si el respiro se comiera el inicio de la palabra).
// ---------------------------------------------------------------------------

const cortes = []; // { in, out, motivo, tipo }

for (const s of silenciosDetectados) {
  if (s.duracion <= umbral_silencio_s) continue;
  let in_ = s.start + respiro_s;
  let out_ = s.end - respiro_s;
  if (out_ - in_ < MIN_RESPIRO_SOBRANTE) continue;
  cortes.push({ in: in_, out: out_, motivo: `silencio ${s.duracion.toFixed(1)} s`, tipo: 'silencio' });
}

// ---------------------------------------------------------------------------
// 2) Muletillas aisladas: la primera palabra de una "frase" (ver más abajo),
//    con un silencio real de > 0.2 s justo antes y justo después.
// ---------------------------------------------------------------------------

function haySilencioCerca(tiempo, lado) {
  // lado "antes": busca un silencio cuyo final esté justo antes de `tiempo`.
  // lado "despues": busca un silencio cuyo inicio esté justo después de `tiempo`.
  const tolerancia = 0.3;
  return silenciosDetectados.some((s) => {
    if (s.duracion < UMBRAL_MULETILLA) return false;
    return lado === 'antes' ? Math.abs(s.end - tiempo) < tolerancia : Math.abs(s.start - tiempo) < tolerancia;
  });
}

const indicesMuletilla = new Set();
for (let i = 0; i < palabras.length; i++) {
  const texto = normalizar(palabras[i].texto);
  if (!MULETILLAS.includes(texto)) continue;
  const esInicioDeFrase = i === 0 || haySilencioCerca(palabras[i].t0, 'antes');
  const siguiente = palabras[i + 1];
  if (esInicioDeFrase && siguiente && haySilencioCerca(siguiente.t0, 'antes')) {
    indicesMuletilla.add(i);
  }
}

function normalizar(texto) {
  return texto
    .toLowerCase()
    .replace(/[.,;:!?¿¡"'«»…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const idx of indicesMuletilla) {
  cortes.push({ in: palabras[idx].t0, out: palabras[idx].t1, motivo: 'muletilla', tipo: 'muletilla' });
}

// ---------------------------------------------------------------------------
// 3) Tomas repetidas: se agrupan las palabras en "frases" usando los
//    silencios grandes ya detectados como límite entre una toma y la
//    siguiente. Si dos frases son muy parecidas (Jaccard sobre trigramas
//    de caracteres > 0.8), se queda la última.
// ---------------------------------------------------------------------------

function trigramas(texto) {
  const t = ` ${texto} `;
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let interseccion = 0;
  for (const tri of a) if (b.has(tri)) interseccion++;
  return interseccion / (a.size + b.size - interseccion);
}

const cortesSilencioGrande = cortes.filter((c) => c.tipo === 'silencio');

// Una "frase" (candidata a toma repetida) termina en cada silencio grande.
// El whisper de palabra por palabra no siempre coincide con el silencio
// real detectado por ffmpeg (el t0 de la palabra que sigue a una pausa
// puede caer un poco antes o después del silencio real); por eso el
// límite se fija en el PUNTO MEDIO del silencio ya recortado, no en los
// bordes exactos, para no quedarse con una palabra "a medias" del lado
// equivocado.
function construirFrases() {
  const limites = cortesSilencioGrande.map((c) => (c.in + c.out) / 2).sort((a, b) => a - b);
  const frases = [];
  let actual = [];
  let li = 0;
  for (const p of palabras) {
    while (li < limites.length && p.t0 >= limites[li]) {
      if (actual.length) frases.push(actual);
      actual = [];
      li++;
    }
    actual.push(p);
  }
  if (actual.length) frases.push(actual);
  return frases;
}

const frases = construirFrases();
const frasesInfo = frases.map((f) => {
  const texto = normalizar(f.map((p) => p.texto).join(' '));
  return { palabras: f, texto, trigramas: trigramas(texto) };
});

const repetidaDe = new Map(); // índice de frase duplicada → índice de la frase que se queda (la última encontrada)
for (let i = 0; i < frasesInfo.length; i++) {
  if (!frasesInfo[i].texto) continue;
  for (let j = i + 1; j < frasesInfo.length; j++) {
    if (!frasesInfo[j].texto) continue;
    if (jaccard(frasesInfo[i].trigramas, frasesInfo[j].trigramas) > 0.8) repetidaDe.set(i, j);
  }
}

for (let i = 0; i < frasesInfo.length; i++) {
  if (!repetidaDe.has(i)) continue;
  const f = frasesInfo[i].palabras;
  cortes.push({ in: f[0].t0, out: f[f.length - 1].t1, motivo: 'toma repetida', tipo: 'repeticion', fraseIdx: i });
}

// ---------------------------------------------------------------------------
// Fusionar cortes que se tocan o se solapan en un solo segmento mantener=false
// ---------------------------------------------------------------------------

cortes.sort((a, b) => a.in - b.in);
const cortesFusionados = [];
for (const c of cortes) {
  const ultimo = cortesFusionados[cortesFusionados.length - 1];
  if (ultimo && c.in <= ultimo.out + 0.02) {
    ultimo.out = Math.max(ultimo.out, c.out);
    if (!ultimo.motivo.includes(c.motivo)) ultimo.motivo += `; ${c.motivo}`;
  } else {
    cortesFusionados.push({ ...c });
  }
}

// ---------------------------------------------------------------------------
// Construir los segmentos finales alternando mantener=true/false. Un
// segmento incluye las palabras cuyo t0 (inicio, el dato fiable) cae dentro.
// ---------------------------------------------------------------------------

function textoEntre(in_, out_) {
  return palabras
    .filter((p) => p.t0 >= in_ && p.t0 < out_)
    .map((p) => p.texto)
    .join(' ');
}

const segmentos = [];
let cursor = 0;
for (const c of cortesFusionados) {
  if (c.in > cursor) segmentos.push({ in: cursor, out: c.in, texto: textoEntre(cursor, c.in), mantener: true, motivo: '' });
  segmentos.push({ in: c.in, out: c.out, texto: textoEntre(c.in, c.out), mantener: false, motivo: c.motivo });
  cursor = c.out;
}
if (cursor < duracion) segmentos.push({ in: cursor, out: duracion, texto: textoEntre(cursor, duracion), mantener: true, motivo: '' });

segmentos.forEach((s, i) => { s.id = i + 1; });

// Completa "se queda la #N" en los motivos de toma repetida, con el id real.
for (const c of cortesFusionados) {
  if (c.tipo !== 'repeticion' || c.fraseIdx === undefined) continue;
  const idxQueSeQueda = repetidaDe.get(c.fraseIdx);
  const primeraPalabraQueSeQueda = frasesInfo[idxQueSeQueda].palabras[0];
  const segQueSeQueda = segmentos.find((s) => s.in <= primeraPalabraQueSeQueda.t0 && primeraPalabraQueSeQueda.t0 < s.out);
  const segActual = segmentos.find((s) => Math.abs(s.in - c.in) < 0.05);
  if (segActual && segQueSeQueda) {
    segActual.motivo = segActual.motivo.replace('toma repetida', `toma repetida; se queda la #${segQueSeQueda.id}`);
  }
}

// ---------------------------------------------------------------------------
// Gancho: 4-7 palabras informativas (más largas) de los primeros 15 s que
// sobrevivan al corte. Claude lo mejora después.
// ---------------------------------------------------------------------------

function proponerGancho() {
  const primeros15 = palabras.filter((p) => p.t0 < 15);
  const esRemovida = (p) => segmentos.some((s) => !s.mantener && p.t0 >= s.in && p.t0 < s.out);
  const candidatas = primeros15.filter((p) => !esRemovida(p));
  const informativas = candidatas.map((p) => normalizar(p.texto)).filter((t) => t.length >= 4).slice(0, 7);
  return informativas.length ? informativas.join(' ') : candidatas.slice(0, 5).map((p) => p.texto).join(' ');
}

// ---------------------------------------------------------------------------
// Salida: EDL + resumen a stderr
// ---------------------------------------------------------------------------

const edl = {
  version: 1,
  fuente: args.fuente,
  formato: 'yap',
  salida: { ancho: 1080, alto: 1920, fps: 30 },
  recorte: { modo: 'cara', anclaX: 0.5 },
  segmentos,
  titulo: { texto: proponerGancho(), desde: 0, hasta: 3 },
  subtitulos: { modo: 'palabra', estilo: 'brand-sheet' },
  musica: { archivo: null, volumen: 0.15, ducking: true },
  zooms: [],
  lower_third: null,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(edl, null, 2));

const duracionFinal = segmentos.filter((s) => s.mantener).reduce((acc, s) => acc + (s.out - s.in), 0);
const numSilencios = cortesFusionados.filter((c) => c.motivo.includes('silencio')).length;
const numRepeticiones = repetidaDe.size;
const numMuletillas = indicesMuletilla.size;

console.error(
  `${duracion.toFixed(0)} s → ${duracionFinal.toFixed(0)} s · ${numSilencios} silencios · ${numRepeticiones} repeticiones · ${numMuletillas} muletillas`,
);
