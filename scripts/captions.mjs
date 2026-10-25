// Genera .trabajo/<nombre>/subs.ass a partir del EDL y palabras.json:
// remapea cada palabra del tiempo FUENTE al tiempo RESULTADO (descontando
// los segmentos eliminados) y escribe subtítulos en modo "palabra" o
// "grupo", con el estilo leído de brand-sheet.md (sección "## Valores" →
// subtitulos.*, ver scripts/lib/brand.mjs).
//
// Uso:
//   node scripts/captions.mjs <edl.json> <palabras.json> [--brand <brand-sheet.md>] [--out <subs.ass>]

import fs from 'node:fs';
import path from 'node:path';
import { leerBrandSheet, hexWebAAss } from './lib/brand.mjs';

function parseArgs(argv) {
  const args = { edlPath: null, palabrasPath: null, brand: 'brand-sheet.md', out: null };
  const posicionales = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--brand') args.brand = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else posicionales.push(a);
  }
  [args.edlPath, args.palabrasPath] = posicionales;
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.edlPath || !args.palabrasPath) {
  console.error('Uso: node scripts/captions.mjs <edl.json> <palabras.json> [--brand <brand-sheet.md>] [--out <subs.ass>]');
  process.exit(1);
}

const edl = JSON.parse(fs.readFileSync(args.edlPath, 'utf8'));
const { palabras } = JSON.parse(fs.readFileSync(args.palabrasPath, 'utf8'));
const outFile = args.out || path.join(path.dirname(args.edlPath), 'subs.ass');

// ---------------------------------------------------------------------------
// Estilo: sección "## Valores" del brand-sheet.md (ver scripts/lib/brand.mjs
// para los valores por defecto si no hay brand sheet).
// ---------------------------------------------------------------------------

const brand = leerBrandSheet(args.brand);
const estilo = {
  fuente: brand.subtitulos.fuente,
  tamano: brand.subtitulos.tamano,
  color: hexWebAAss(brand.subtitulos.color),
  colorAcento: hexWebAAss(brand.subtitulos.acento),
  borde: hexWebAAss(brand.subtitulos.borde),
  bordePx: brand.subtitulos.borde_px,
  posicionY: brand.subtitulos.posicion_y,
};

// ---------------------------------------------------------------------------
// Remapeo de tiempos: FUENTE → RESULTADO, usando los segmentos mantener=true
// del EDL en orden. Las palabras que caen dentro de un segmento eliminado
// no aparecen en el resultado.
// ---------------------------------------------------------------------------

const kept = [];
{
  let acumulado = 0;
  for (const s of edl.segmentos) {
    if (!s.mantener) continue;
    kept.push({ in: s.in, out: s.out, acumulado });
    acumulado += s.out - s.in;
  }
}

function segmentoDe(tFuente) {
  return kept.find((s) => tFuente >= s.in && tFuente <= s.out) || null;
}

function mapear(tFuente, segmento) {
  if (!segmento) return null;
  return segmento.acumulado + (tFuente - segmento.in);
}

const palabrasResultado = [];
for (const p of palabras) {
  const segmento = segmentoDe(p.t0);
  if (!segmento) continue; // la palabra cayó en un segmento eliminado
  const t0 = mapear(p.t0, segmento);
  // si el final de la palabra se mete en el corte siguiente (queda justo en
  // el borde), se recorta al final del propio segmento.
  const finReal = Math.min(p.t1, segmento.out);
  const t1 = mapear(finReal, segmento);
  if (t1 <= t0) continue;
  palabrasResultado.push({ ...p, t0, t1 });
}

// ---------------------------------------------------------------------------
// ASS: cabecera + estilos + eventos
// ---------------------------------------------------------------------------

function tiempoAss(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
}

function escaparTexto(t) {
  return t.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

const ancho = edl.salida?.ancho || 1080;
const alto = edl.salida?.alto || 1920;
// posicion_y es la fracción de la altura donde va el texto (0 = arriba); en ASS
// con Alignment=2 (abajo-centro) el margen se mide desde el borde inferior.
const margenV = Math.round(alto * (1 - estilo.posicionY));

function colorDePalabra(texto) {
  return /\d/.test(texto) ? estilo.colorAcento : estilo.color;
}

const cabecera = `[Script Info]
ScriptType: v4.00+
PlayResX: ${ancho}
PlayResY: ${alto}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Palabra,${estilo.fuente},${estilo.tamano},${estilo.color},${estilo.colorAcento},${estilo.borde},&H00000000,1,0,0,0,100,100,0,0,1,${estilo.bordePx},1,2,40,40,${margenV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

// El EDL puede traer un modo explícito (Claude lo ajustó durante la revisión);
// si no, manda el modo definido en el brand sheet del nicho/estilo.
const modo = (edl.subtitulos?.modo || brand.subtitulos.modo) === 'grupo' ? 'grupo' : 'palabra';
const eventos = [];

if (modo === 'palabra') {
  for (const p of palabrasResultado) {
    const color = colorDePalabra(p.texto);
    const texto = color === estilo.color
      ? escaparTexto(p.texto)
      : `{\\c${color}}${escaparTexto(p.texto)}{\\r}`;
    eventos.push(`Dialogue: 0,${tiempoAss(p.t0)},${tiempoAss(p.t1)},Palabra,,0,0,0,,${texto}`);
  }
} else {
  // Grupos de 3 palabras; un evento por palabra activa dentro del grupo,
  // mostrando siempre las 3 con la activa resaltada en color de acento.
  for (let i = 0; i < palabrasResultado.length; i += 3) {
    const grupo = palabrasResultado.slice(i, i + 3);
    for (const activa of grupo) {
      const texto = grupo
        .map((p) => (p === activa ? `{\\c${estilo.colorAcento}}${escaparTexto(p.texto)}{\\r}` : escaparTexto(p.texto)))
        .join(' ');
      eventos.push(`Dialogue: 0,${tiempoAss(activa.t0)},${tiempoAss(activa.t1)},Palabra,,0,0,0,,${texto}`);
    }
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, cabecera + eventos.join('\n') + '\n');

console.error(`subs.ass: ${palabrasResultado.length} palabras · modo "${modo}" · ${outFile}`);
