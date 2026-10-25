// Convierte un EDL en un solo comando ffmpeg y produce el video en
// exportados/. Nunca escribe fuera de exportados/ y .trabajo/, y nunca usa
// -y sobre material-crudo. El borrador siempre se sobreescribe
// (<nombre>_borrador.mp4); un final nunca: cada uno queda como
// <nombre>_v{N}.mp4 junto con el EDL exacto que lo produjo
// (<nombre>_v{N}.edl.json), para poder volver a una versión anterior.
//
// Uso:
//   node scripts/render.mjs <edl.json> --borrador
//   node scripts/render.mjs <edl.json> --final
//   node scripts/render.mjs <edl.json> --borrador --muestra 10   (solo los primeros N s)
//   node scripts/render.mjs <edl.json> --borrador --brand <ruta> (brand sheet distinto al de la carpeta)
//
// El título y los subtítulos leen su tipografía, tamaño y color de
// brand-sheet.md (sección "## Valores"); ver scripts/lib/brand.mjs.
// Las recetas de cada filtro están documentadas en references/ffmpeg-recetas.md.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findFfmpeg } from './lib/paths.mjs';
import { leerBrandSheet, hexWebAFfmpeg, FONTS_DIR, rutaFuente } from './lib/brand.mjs';

function parseArgs(argv) {
  const args = { edlPath: null, modo: null, muestra: null, brand: 'brand-sheet.md' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--borrador' || a === '--final') args.modo = a.slice(2);
    else if (a === '--muestra') args.muestra = Number(argv[++i]);
    else if (a === '--brand') args.brand = argv[++i];
    else if (!args.edlPath) args.edlPath = a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.edlPath || !args.modo) {
  console.error('Uso: node scripts/render.mjs <edl.json> --borrador | --final');
  process.exit(1);
}

const edl = JSON.parse(fs.readFileSync(args.edlPath, 'utf8'));
// nombre y dirTrabajo salen del "fuente" del EDL, NO de dónde vive el
// archivo edl.json: así renderizar desde una copia guardada en exportados/
// (p. ej. para volver a una versión anterior) sigue encontrando
// palabras.json/subs.ass en su carpeta .trabajo/ de siempre.
const nombre = path.basename(edl.fuente, path.extname(edl.fuente));
const dirTrabajo = path.join('.trabajo', nombre);

if (!fs.existsSync(edl.fuente)) {
  console.error(`No encuentro el video fuente: ${edl.fuente}`);
  process.exit(1);
}

const ffmpeg = findFfmpeg();
if (!ffmpeg) {
  console.error('ffmpeg no está instalado. Corre /video-editor para instalarlo.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Subtítulos frescos: se regeneran a partir del EDL actual antes de renderizar.
// ---------------------------------------------------------------------------

const palabrasPath = path.join(dirTrabajo, 'palabras.json');
const subsPath = path.join(dirTrabajo, 'subs.ass');
if (fs.existsSync(palabrasPath)) {
  const captionsScript = path.join(path.dirname(new URL(import.meta.url).pathname), 'captions.mjs');
  const res = spawnSync(
    'node',
    [captionsScript, args.edlPath, palabrasPath, '--brand', args.brand, '--out', subsPath],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) console.error((res.stderr || '').trim());
}

// ---------------------------------------------------------------------------
// Salida: exportados/<nombre>_borrador.mp4 (se sobreescribe) o
// exportados/<nombre>_v{N}.mp4 (N = siguiente versión libre)
// ---------------------------------------------------------------------------

const exportadosDir = 'exportados';
fs.mkdirSync(exportadosDir, { recursive: true });

function siguienteVersion() {
  const existentes = fs.existsSync(exportadosDir) ? fs.readdirSync(exportadosDir) : [];
  const versiones = existentes
    .map((f) => f.match(new RegExp(`^${nombre}_v(\\d+)\\.mp4$`)))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  return versiones.length ? Math.max(...versiones) + 1 : 1;
}

const version = args.modo === 'final' ? siguienteVersion() : null;
const salidaPath =
  args.modo === 'borrador'
    ? path.join(exportadosDir, `${nombre}_borrador.mp4`)
    : path.join(exportadosDir, `${nombre}_v${version}.mp4`);

if (path.resolve(edl.fuente).startsWith(path.resolve('material-crudo'))) {
  if (path.resolve(salidaPath) === path.resolve(edl.fuente)) {
    console.error('No se puede escribir sobre material-crudo.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// filter_complex: concatenar segmentos mantener=true, recortar a 9:16,
// zooms, título/lower-third, subtítulos. Audio: voz + música con ducking.
// ---------------------------------------------------------------------------

const kept = edl.segmentos.filter((s) => s.mantener);
if (kept.length === 0) {
  console.error('El EDL no tiene ningún segmento para conservar.');
  process.exit(1);
}

const filtros = [];
let duracionResultado = 0;

// Lista de inputs de ffmpeg: 0 es siempre edl.fuente; imágenes y música se
// agregan más abajo y cada una reserva su propio índice con
// siguienteInputIndex, en el orden en que de verdad se van a usar.
const inputs = ['-i', edl.fuente];
let siguienteInputIndex = 1;

// 1) trim por segmento + concat
const etiquetasV = [];
const etiquetasA = [];
kept.forEach((s, i) => {
  filtros.push(`[0:v]trim=start=${s.in}:end=${s.out},setpts=PTS-STARTPTS[v${i}]`);
  filtros.push(`[0:a]atrim=start=${s.in}:end=${s.out},asetpts=PTS-STARTPTS[a${i}]`);
  etiquetasV.push(`[v${i}]`);
  etiquetasA.push(`[a${i}]`);
  duracionResultado += s.out - s.in;
});
const entradasConcat = kept.map((_, i) => `[v${i}][a${i}]`).join('');
filtros.push(`${entradasConcat}concat=n=${kept.length}:v=1:a=1[vcat][acat]`);

// 2) recorte a la relación de salida (centrado, o anclado si modo="cara") + scale
const ancho = edl.salida?.ancho || 1080;
const alto = edl.salida?.alto || 1920;
const ancla = edl.recorte?.modo === 'cara' ? (edl.recorte.anclaX ?? 0.5) : 0.5;
const cropW = `min(iw,ih*${ancho}/${alto})`;
const cropH = `min(ih,iw*${alto}/${ancho})`;
filtros.push(
  `[vcat]crop='${cropW}':'${cropH}':'(iw-(${cropW}))*${ancla}':'(ih-(${cropH}))/2',scale=${ancho}:${alto}[vcrop]`,
);
let labelV = 'vcrop';

// 3) zooms: zoompan con easing 1.0 → factor → 1.0 dentro de [en, en+duracion]
const zooms = Array.isArray(edl.zooms) ? edl.zooms : [];
if (zooms.length) {
  const fps = edl.salida?.fps || 30;
  const terminos = zooms
    .map((z) => `if(between(time,${z.en},${z.en + z.duracion}),1+(${z.factor}-1)*sin(PI*(time-${z.en})/${z.duracion}),0)`)
    .join('+');
  filtros.push(
    `[${labelV}]zoompan=z='1+(${terminos})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${ancho}x${alto}:fps=${fps}[vzoom]`,
  );
  labelV = 'vzoom';
}

// 4) título y lower-third: drawtext con caja semitransparente
function escaparDrawtext(t) {
  return String(t).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

const FUENTE_SISTEMA =
  process.platform === 'darwin'
    ? '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    : process.platform === 'win32'
      ? 'C:\\Windows\\Fonts\\arialbd.ttf'
      : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function drawtext(label, texto, desde, hasta, y, { fontFile, fontSize, boxColor }) {
  const salidaLabel = `${label}t`;
  filtros.push(
    `[${label}]drawtext=fontfile='${fontFile}':text='${escaparDrawtext(texto)}':fontsize=${fontSize}:fontcolor=white:` +
      `box=1:boxcolor=${boxColor}:boxborderw=20:x=(w-text_w)/2:y=${y}:enable='between(t,${desde},${hasta})'[${salidaLabel}]`,
  );
  return salidaLabel;
}

// El título lee su tipografía, tamaño y caja del brand sheet (sección
// "## Valores" → titulo.*); el lower-third usa valores fijos porque el
// esquema del brand sheet no lo define.
const brand = leerBrandSheet(args.brand);
const fuenteTitulo = rutaFuente(brand.titulo.fuente) || FUENTE_SISTEMA;

if (edl.titulo?.texto) {
  labelV = drawtext(labelV, edl.titulo.texto, edl.titulo.desde, edl.titulo.hasta, 'h*0.12', {
    fontFile: fuenteTitulo,
    fontSize: brand.titulo.tamano,
    boxColor: hexWebAFfmpeg(brand.titulo.caja),
  });
}
if (edl.lower_third?.texto) {
  labelV = drawtext(labelV, edl.lower_third.texto, edl.lower_third.desde, edl.lower_third.hasta, 'h*0.85', {
    fontFile: FUENTE_SISTEMA,
    fontSize: 64,
    boxColor: 'black@0.5',
  });
}

// 4.5) imágenes superpuestas (logo, foto, gráfico fijo): se escalan según
// el ancho del video con scale2ref, y se superponen solo en su ventana de
// tiempo. Van antes de los subtítulos para que el texto quede siempre
// encima y legible.
function posicionImagen(nombre) {
  const MARGEN = 40;
  switch (nombre) {
    case 'arriba-izq':
      return [`${MARGEN}`, `${MARGEN}`];
    case 'abajo-izq':
      return [`${MARGEN}`, `main_h-overlay_h-${MARGEN}`];
    case 'abajo-der':
      return [`main_w-overlay_w-${MARGEN}`, `main_h-overlay_h-${MARGEN}`];
    case 'centro':
      return ['(main_w-overlay_w)/2', '(main_h-overlay_h)/2'];
    case 'arriba-der':
    default:
      return [`main_w-overlay_w-${MARGEN}`, `${MARGEN}`];
  }
}

const imagenes = Array.isArray(edl.imagenes) ? edl.imagenes : [];
for (const img of imagenes) {
  if (!img.archivo || !fs.existsSync(img.archivo)) {
    console.error(`Imagen no encontrada, se omite: ${img.archivo}`);
    continue;
  }
  const idx = siguienteInputIndex++;
  inputs.push('-i', img.archivo);
  const ancho = img.ancho ?? 0.25;
  const [x, y] = posicionImagen(img.posicion);
  const escaladaLabel = `img${idx}esc`;
  const pasoLabel = `img${idx}paso`;
  const overlayLabel = `img${idx}ov`;
  // scale2ref: [a escalar][referencia]scale2ref=...[escalada][referencia_intacta]
  filtros.push(`[${idx}:v][${labelV}]scale2ref=w='main_w*${ancho}':h=-1[${escaladaLabel}][${pasoLabel}]`);
  const desde = img.en ?? 0;
  const hasta = desde + (img.duracion ?? duracionResultado);
  filtros.push(
    `[${pasoLabel}][${escaladaLabel}]overlay=${x}:${y}:enable='between(t,${desde},${hasta})'[${overlayLabel}]`,
  );
  labelV = overlayLabel;
}

// 5) subtítulos
if (fs.existsSync(subsPath)) {
  const subsEsc = subsPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  filtros.push(`[${labelV}]ass='${subsEsc}':fontsdir='${FONTS_DIR.replace(/\\/g, '/')}'[vsubs]`);
  labelV = 'vsubs';
}

// 6) música con ducking (si hay pista y existe el archivo)
let labelA = 'acat';
if (edl.musica?.archivo && fs.existsSync(edl.musica.archivo)) {
  const idxMusica = siguienteInputIndex++;
  inputs.push('-stream_loop', '-1', '-i', edl.musica.archivo);
  const volumen = edl.musica.volumen ?? 0.15;
  filtros.push(`[${idxMusica}:a]volume=${volumen},atrim=duration=${duracionResultado}[musica]`);
  if (edl.musica.ducking) {
    filtros.push(
      `[musica][acat]sidechaincompress=threshold=0.05:ratio=8:attack=50:release=400[musicaducked]`,
    );
    filtros.push(`[acat][musicaducked]amix=inputs=2:duration=first:weights=1 1[amix]`);
  } else {
    filtros.push(`[acat][musica]amix=inputs=2:duration=first[amix]`);
  }
  filtros.push(`[amix]afade=t=out:st=${Math.max(0, duracionResultado - 1)}:d=1[afin]`);
  labelA = 'afin';
}

// 7) normalización de volumen (solo en el final)
if (args.modo === 'final') {
  filtros.push(`[${labelA}]loudnorm=I=-14:TP=-1.5:LRA=11[anorm]`);
  labelA = 'anorm';
}

// ---------------------------------------------------------------------------
// Comando ffmpeg
// ---------------------------------------------------------------------------

// --muestra recorta la duración de salida (p. ej. una muestra de 10 s para
// previsualizar un estilo nuevo); el resto del grafo de filtros no cambia.
const duracionSalida = args.muestra ? Math.min(args.muestra, duracionResultado) : duracionResultado;

// -t y -map_metadata -1: sin esto, un input de música en loop infinito (o la
// metadata del propio material-crudo) puede dejar mal la duración del
// contenedor de salida aunque el stream de video ya esté bien recortado.
const comun = [
  '-y', ...inputs,
  '-filter_complex', filtros.join(';'),
  '-map', `[${labelV}]`, '-map', `[${labelA}]`,
  '-t', String(duracionSalida),
  '-map_metadata', '-1',
];

const salidaArgs =
  args.modo === 'borrador'
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-c:a', 'aac']
    : [
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
      ];

const comando = [...comun, ...salidaArgs, salidaPath];

console.error(`Renderizando ${args.modo}… 0 %`);
const proceso = spawn(ffmpeg.path, comando, { stdio: ['ignore', 'ignore', 'pipe'] });

let stderrCompleto = '';
proceso.stderr.on('data', (chunk) => {
  const texto = chunk.toString();
  stderrCompleto += texto;
  const m = texto.match(/time=(\d+):(\d+):([\d.]+)/);
  if (m) {
    const segundos = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    const pct = Math.min(100, Math.round((segundos / duracionSalida) * 100));
    console.error(`Renderizando ${args.modo}… ${pct} %`);
  }
});

proceso.on('close', (code) => {
  if (code !== 0) {
    console.error('ffmpeg no pudo terminar el render.');
    console.error(stderrCompleto.trim().split(/\r?\n/).slice(-15).join('\n'));
    process.exit(1);
  }
  // Cada versión final guarda al lado el EDL exacto que la produjo, para
  // poder volver a una versión anterior ("la v1 estaba mejor") sin adivinar
  // qué edl.json tenía en ese momento — el de .trabajo/ se sigue editando.
  if (args.modo === 'final' && !args.muestra) {
    const edlCopiaPath = path.join(exportadosDir, `${nombre}_v${version}.edl.json`);
    fs.writeFileSync(edlCopiaPath, JSON.stringify(edl, null, 2));
  }
  console.error(`Listo: ${salidaPath}`);
  console.log(salidaPath);
});
