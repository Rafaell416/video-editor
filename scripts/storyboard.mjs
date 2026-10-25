// Genera un storyboard.html autocontenido a partir de un EDL: una fila por
// segmento con su frame más cercano, texto, duración, estado y motivo. Es lo
// que el alumno revisa antes de que se renderice nada.
//
// Uso:
//   node scripts/storyboard.mjs <edl.json> [--palabras <ruta>] [--out <ruta>]

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { edlPath: null, palabrasPath: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--palabras') args.palabrasPath = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (!args.edlPath) args.edlPath = a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.edlPath) {
  console.error('Uso: node scripts/storyboard.mjs <edl.json> [--palabras <ruta>] [--out <ruta>]');
  process.exit(1);
}
if (!fs.existsSync(args.edlPath)) {
  console.error(`No encuentro el EDL: ${args.edlPath}`);
  process.exit(1);
}

const edl = JSON.parse(fs.readFileSync(args.edlPath, 'utf8'));
const dirTrabajo = path.dirname(args.edlPath);
const nombre = path.basename(dirTrabajo);

const palabrasPath = args.palabrasPath || path.join(dirTrabajo, 'palabras.json');
const palabras = fs.existsSync(palabrasPath) ? JSON.parse(fs.readFileSync(palabrasPath, 'utf8')) : null;

const framesDir = path.join(dirTrabajo, 'frames');
const FRAME_PASO_S = 2.5; // igual que transcribe.mjs --frames

function framePara(segundosFuente) {
  const indice = Math.max(1, Math.round(segundosFuente / FRAME_PASO_S) + 1);
  const nombreFrame = `frame_${String(indice).padStart(4, '0')}.jpg`;
  if (fs.existsSync(path.join(framesDir, nombreFrame))) return `frames/${nombreFrame}`;
  return null;
}

function escaparHtml(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatoDuracion(s) {
  return `${s.toFixed(1)} s`;
}

// ---------------------------------------------------------------------------
// Resumen: duración antes/después, gancho, 3 líneas de "qué quité"
// ---------------------------------------------------------------------------

const segmentos = edl.segmentos || [];
const duracionAntes = palabras?.duracion ?? (segmentos.length ? segmentos[segmentos.length - 1].out : 0);
const duracionDespues = segmentos.filter((s) => s.mantener).reduce((acc, s) => acc + (s.out - s.in), 0);

const quitados = segmentos.filter((s) => !s.mantener);
function contarMotivo(fragmento) {
  const coincidencias = quitados.filter((s) => (s.motivo || '').includes(fragmento));
  const segundos = coincidencias.reduce((acc, s) => acc + (s.out - s.in), 0);
  return { n: coincidencias.length, segundos };
}
const silencios = contarMotivo('silencio');
const repeticiones = contarMotivo('toma repetida');
const muletillas = contarMotivo('muletilla');

const lineasQuite = [];
if (silencios.n) lineasQuite.push(`${silencios.n} silencios (${formatoDuracion(silencios.segundos)})`);
if (repeticiones.n) lineasQuite.push(`${repeticiones.n} tomas repetidas (${formatoDuracion(repeticiones.segundos)})`);
if (muletillas.n) lineasQuite.push(`${muletillas.n} muletillas (${formatoDuracion(muletillas.segundos)})`);
const sinClasificar = quitados.filter(
  (s) => !/silencio|toma repetida|muletilla/.test(s.motivo || ''),
);
if (sinClasificar.length) {
  const segundos = sinClasificar.reduce((acc, s) => acc + (s.out - s.in), 0);
  lineasQuite.push(`${sinClasificar.length} otros cortes (${formatoDuracion(segundos)})`);
}

const gancho = edl.titulo?.texto || '(sin título)';

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const filas = segmentos
  .map((s) => {
    const frame = framePara(s.in);
    const imgHtml = frame
      ? `<img src="${frame}" alt="">`
      : `<div class="noimg">sin frame</div>`;
    const estadoClase = s.mantener ? 'queda' : 'va';
    const estadoTexto = s.mantener ? 'se queda' : 'se va';
    return `<tr class="${estadoClase}">
      <td class="col-frame">${imgHtml}</td>
      <td class="col-texto">${escaparHtml(s.texto || '')}</td>
      <td class="col-dur">${formatoDuracion(s.out - s.in)}</td>
      <td class="col-estado"><span class="pill ${estadoClase}">${estadoTexto}</span></td>
      <td class="col-motivo">${escaparHtml(s.motivo || '')}</td>
    </tr>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storyboard · ${escaparHtml(nombre)}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;padding:14px;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#f4f5f7;color:#1a1f27}
  h1{font-size:17px;margin:0 0 4px}
  .resumen{background:#fff;border:1px solid #dde1e7;border-radius:10px;padding:14px;margin:0 0 14px}
  .duraciones{font-size:13px;color:#555;margin:0 0 10px}
  .duraciones b{color:#1a1f27}
  .gancho-label{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#888;margin:0 0 2px}
  .gancho{font-size:18px;font-weight:700;margin:0 0 12px;line-height:1.3}
  .quite-label{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#888;margin:0 0 4px}
  .quite ul{margin:0;padding-left:18px;font-size:13.5px}
  .quite li{margin:0 0 3px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #dde1e7}
  td{padding:8px;border-bottom:1px solid #eceff3;font-size:13px;vertical-align:top}
  tr:last-child td{border-bottom:none}
  tr.va{opacity:.45}
  .col-frame{width:72px}
  .col-frame img{width:64px;border-radius:6px;display:block}
  .noimg{width:64px;height:40px;border-radius:6px;background:#eef0f3;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999}
  .col-dur{white-space:nowrap;color:#555}
  .col-estado{white-space:nowrap}
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
  .pill.queda{background:#ddf0ea;color:#1e7f6e}
  .pill.va{background:#eceff3;color:#777}
  .col-motivo{color:#888;font-size:12px}
  .cierre{background:#fff;border:1px solid #dde1e7;border-radius:10px;padding:14px;margin-top:14px;font-size:13.5px;line-height:1.5}
  .cierre code{background:#f4f5f7;padding:1px 5px;border-radius:4px;font-size:12.5px}
</style>
</head>
<body>
  <h1>${escaparHtml(nombre)}</h1>
  <div class="resumen">
    <p class="duraciones"><b>${formatoDuracion(duracionAntes)}</b> → <b>${formatoDuracion(duracionDespues)}</b></p>
    <p class="gancho-label">Gancho propuesto</p>
    <p class="gancho">${escaparHtml(gancho)}</p>
    <p class="quite-label">Qué quité</p>
    <div class="quite"><ul>${lineasQuite.map((l) => `<li>${escaparHtml(l)}</li>`).join('') || '<li>Nada, el video quedó igual.</li>'}</ul></div>
  </div>
  <table>
    <tbody>
      ${filas}
    </tbody>
  </table>
  <div class="cierre">
    Para aprobar escribe: <code>aprobado</code>.<br>
    Para cambiar algo, dímelo como a un editor: "deja la pausa después de X",
    "usa la primera toma de Y", "el gancho que diga Z".
  </div>
</body>
</html>
`;

const outPath = args.out || path.join(dirTrabajo, 'storyboard.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.error(`Listo: ${outPath}`);
console.log(outPath);
