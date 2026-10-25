// Busca e instala una fuente de Google Fonts por nombre de familia, sin
// dependencias (usa fetch nativo de Node). Guarda el archivo y su licencia
// en la carpeta destino (por defecto fuentes/, la del alumno).
//
// Uso:
//   node scripts/fonts.mjs "<nombre de familia>" [--peso Black] [--destino fuentes]
//
// Prefiere siempre un archivo ESTÁTICO por peso (p. ej. Poppins-Black.ttf)
// sobre una fuente variable: libass, al escanear fontsdir, solo reconoce la
// instancia por defecto de una fuente variable (ver scripts/lib/fonts.mjs),
// así que un peso que solo existe como instancia con nombre de una fuente
// variable no es usable de forma confiable.

import fs from 'node:fs';
import path from 'node:path';
import { leerNombreFamilia } from './lib/fonts.mjs';

function parseArgs(argv) {
  const args = { nombre: null, peso: null, destino: 'fuentes' };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--peso') args.peso = argv[++i];
    else if (a === '--destino') args.destino = argv[++i];
    else pos.push(a);
  }
  args.nombre = pos.join(' ').trim();
  return args;
}

function slug(nombre) {
  return nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const LICENCIAS = ['ofl', 'apache', 'ufl'];

async function listarCarpeta(ruta) {
  const res = await fetch(`https://api.github.com/repos/google/fonts/contents/${ruta}`, {
    headers: { 'User-Agent': 'video-editor-plugin' },
  });
  if (!res.ok) return null;
  return res.json();
}

async function descargarArchivo(url, destino) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No pude descargar ${url} (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destino, buf);
}

const args = parseArgs(process.argv.slice(2));
if (!args.nombre) {
  console.error('Uso: node scripts/fonts.mjs "<nombre de familia>" [--peso Black] [--destino fuentes]');
  process.exit(1);
}

try {
  const slugNombre = slug(args.nombre);
  let carpeta = null;
  let licencia = null;
  for (const lic of LICENCIAS) {
    const listado = await listarCarpeta(`${lic}/${slugNombre}`);
    if (listado) {
      carpeta = listado;
      licencia = lic;
      break;
    }
  }
  if (!carpeta) {
    console.error(
      `No encontré "${args.nombre}" en Google Fonts (busqué la carpeta "${slugNombre}"). ` +
        'Revisa que el nombre sea exacto como aparece en fonts.google.com, o descarga el ' +
        `archivo .ttf a mano y déjalo en ${args.destino}/.`,
    );
    process.exit(1);
  }

  const archivosTtf = carpeta.filter((f) => /\.ttf$/i.test(f.name));
  const estaticosNoItalica = archivosTtf.filter((f) => !/\[.*\]/.test(f.name) && !/italic/i.test(f.name));

  let elegido = null;
  let esVariable = false;

  if (args.peso) {
    const pesoNorm = args.peso.toLowerCase().replace(/\s/g, '');
    elegido = estaticosNoItalica.find((f) => f.name.toLowerCase().replace(/\s/g, '').includes(pesoNorm));
  }
  if (!elegido) elegido = estaticosNoItalica.find((f) => /regular/i.test(f.name));
  if (!elegido && estaticosNoItalica.length) elegido = estaticosNoItalica[0];
  if (!elegido) {
    // Solo queda la fuente variable: sirve, pero únicamente como un peso
    // (el que traiga por defecto, normalmente Regular).
    elegido = archivosTtf.find((f) => /\[.*\]/.test(f.name) && !/italic/i.test(f.name));
    esVariable = true;
  }
  if (!elegido) {
    console.error(`Encontré "${args.nombre}" en Google Fonts pero no un archivo .ttf usable ahí dentro.`);
    process.exit(1);
  }

  fs.mkdirSync(args.destino, { recursive: true });
  const destinoArchivo = path.join(args.destino, elegido.name);
  await descargarArchivo(elegido.download_url, destinoArchivo);

  const archivoLicencia = carpeta.find((f) => /^(OFL|LICENSE|UFL)\.txt$/i.test(f.name));
  if (archivoLicencia) {
    const nombreLicenciaLocal = `LICENCIA-${elegido.name.replace(/\.(ttf|otf)$/i, '')}.txt`;
    await descargarArchivo(archivoLicencia.download_url, path.join(args.destino, nombreLicenciaLocal));
  }

  const familiaReal = leerNombreFamilia(destinoArchivo);
  const resultado = {
    archivo: destinoArchivo,
    familia: familiaReal,
    licencia: licencia.toUpperCase(),
    variable: esVariable,
  };

  if (esVariable && args.peso) {
    console.error(
      `"${args.nombre}" en Google Fonts solo existe como fuente variable: no hay un archivo ` +
        `separado para el peso "${args.peso}". Descargué la instancia por defecto ("${familiaReal}"); ` +
        'otros pesos de esta familia no se pueden usar de forma confiable.',
    );
  } else {
    console.error(`Descargada "${args.nombre}" (${elegido.name}). Nombre real para el brand sheet: "${familiaReal}".`);
  }
  console.log(JSON.stringify(resultado, null, 2));
} catch (err) {
  console.error(
    `No pude conectarme a Google Fonts (${err.message}). Revisa la conexión a internet, o descarga ` +
      `el archivo .ttf a mano desde fonts.google.com y déjalo en ${args.destino}/.`,
  );
  process.exit(1);
}
