// Lee la sección "## Valores" de un brand-sheet.md: un subconjunto de YAML de
// dos niveles (secciones con claves simples, y una lista con "- "), sin
// dependencias externas porque el formato es fijo y lo define este mismo
// plugin (ver templates/brand-sheet.md).
//
// captions.mjs y render.mjs leen de aquí todo lo visual; nunca hardcodean
// un valor que el brand sheet pueda definir.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'fonts');

// Nombre de familia (como se escribe en un brand sheet) → archivo real en
// templates/fonts/. Lora es una sola fuente variable: todos sus pesos viven
// en el mismo archivo, libass/drawtext elige la instancia por nombre.
const MAPA_FUENTES = {
  archivoblack: 'ArchivoBlack-Regular.ttf',
  bebasneue: 'BebasNeue-Regular.ttf',
  interblack: 'Inter-Black.ttf',
  inter: 'Inter-Black.ttf',
  lora: 'Lora-Regular.ttf',
  loraregular: 'Lora-Regular.ttf',
  lorabold: 'Lora-Regular.ttf',
  lorasemibold: 'Lora-Regular.ttf',
  loramedium: 'Lora-Regular.ttf',
};

export function rutaFuente(nombre) {
  const clave = String(nombre || '').toLowerCase().replace(/[\s-]/g, '');
  const archivo = MAPA_FUENTES[clave];
  if (!archivo) return null;
  const ruta = path.join(FONTS_DIR, archivo);
  return fs.existsSync(ruta) ? ruta : null;
}

export const VALORES_POR_DEFECTO = {
  subtitulos: {
    modo: 'palabra', // palabra | grupo
    fuente: 'Arial Black',
    tamano: 68,
    color: '#FFFFFF',
    acento: '#32A8FC',
    borde: '#000000',
    borde_px: 4,
    posicion_y: 0.8,
  },
  titulo: {
    fuente: 'Arial Black',
    tamano: 64,
    caja: '#000000AA',
  },
  ritmo: {
    umbral_silencio_s: 0.5,
    zoom_factor: 1.15,
    zooms_por_minuto: 0,
  },
  musica: {
    estilo: null,
    volumen: 0.15,
  },
  nunca: [],
};

function clonarDefecto() {
  return JSON.parse(JSON.stringify(VALORES_POR_DEFECTO));
}

function parsearValor(crudo) {
  let v = crudo.trim();
  const citado = v.match(/^(["'])(.*?)\1/);
  if (citado) {
    v = citado[2];
  } else {
    v = v.replace(/\s+#.*$/, '').trim();
  }
  if (v === '' || v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function extraerBloqueYaml(texto) {
  const seccion = texto.match(/##\s*Valores[\s\S]*?```ya?ml\n([\s\S]*?)```/i);
  return seccion ? seccion[1] : null;
}

function parsearYamlSimple(bloque) {
  const valores = clonarDefecto();
  let seccionActual = null;
  for (const lineaCruda of bloque.split(/\r?\n/)) {
    if (!lineaCruda.trim() || lineaCruda.trim().startsWith('#')) continue;
    const indentado = /^\s/.test(lineaCruda);
    const linea = lineaCruda.trim();

    if (!indentado) {
      const m = linea.match(/^([a-z_]+):\s*$/i);
      if (m) {
        seccionActual = m[1];
        if (!(seccionActual in valores)) valores[seccionActual] = {};
      }
      continue;
    }
    if (!seccionActual) continue;

    const item = linea.match(/^-\s*(.+)$/);
    if (item) {
      if (!Array.isArray(valores[seccionActual])) valores[seccionActual] = [];
      valores[seccionActual].push(parsearValor(item[1]));
      continue;
    }

    const par = linea.match(/^([a-z_]+):\s*(.+)$/i);
    if (par) {
      if (typeof valores[seccionActual] !== 'object' || Array.isArray(valores[seccionActual])) {
        valores[seccionActual] = {};
      }
      valores[seccionActual][par[1]] = parsearValor(par[2]);
    }
  }
  return valores;
}

export function leerBrandSheet(rutaBrand) {
  if (!rutaBrand || !fs.existsSync(rutaBrand)) return clonarDefecto();
  const texto = fs.readFileSync(rutaBrand, 'utf8');
  const bloque = extraerBloqueYaml(texto);
  if (!bloque) return clonarDefecto();
  return parsearYamlSimple(bloque);
}

// Hex web (#RRGGBB o #RRGGBBAA, alpha 00=transparente..FF=opaco) a color ASS
// (&HAABBGGRR, alpha 00=opaco..FF=transparente: orden y semántica invertidos).
export function hexWebAAss(hex) {
  const limpio = String(hex || '#FFFFFF').replace('#', '');
  const r = limpio.slice(0, 2) || 'FF';
  const g = limpio.slice(2, 4) || 'FF';
  const b = limpio.slice(4, 6) || 'FF';
  const alphaWeb = limpio.length >= 8 ? parseInt(limpio.slice(6, 8), 16) : 255;
  const alphaAss = (255 - alphaWeb).toString(16).padStart(2, '0').toUpperCase();
  return `&H${alphaAss}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
}

// Hex web a la sintaxis de color de ffmpeg (0xRRGGBB[AA]): mismo orden y
// semántica de alpha que el web, solo cambia el prefijo.
export function hexWebAFfmpeg(hex) {
  return `0x${String(hex || '#000000').replace('#', '').toUpperCase()}`;
}
