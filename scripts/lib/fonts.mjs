// Lee el nombre de familia real de un archivo .ttf/.otf directamente de su
// tabla "name" (formato sfnt), sin dependencias ni herramientas del sistema
// (nada de fontconfig/fc-scan: en una Mac o Windows recién instalada puede
// no existir). Con esto el plugin puede reconocer CUALQUIER fuente que el
// alumno deje en fuentes/, no solo las que empaquetamos.
//
// Dos cosas que se confirmaron probando contra libass (no son teoría):
// 1. libass/FreeType buscan por el nameID 1 ("family name" clásico, p. ej.
//    "Inter Black"), NO por el nameID 16 ("familia tipográfica preferida",
//    p. ej. solo "Inter"). Si se usa el 16 por error, un peso como "Black"
//    deja de encontrarse y cae en silencio a una fuente del sistema.
// 2. En una fuente VARIABLE (un solo archivo con varios pesos por "fvar"),
//    libass al escanear fontsdir solo ve el nameID 1 de la instancia por
//    defecto (normalmente "Regular"). Nombres de instancia con peso, como
//    "Lora Bold" o "Lora SemiBold", no existen como family aparte en la
//    tabla "name" y por eso tampoco se encuentran — caen en silencio a una
//    fuente del sistema. Por eso scripts/fonts.mjs prefiere siempre un
//    archivo ESTÁTICO por peso cuando existe, en vez de confiar en
//    instancias con nombre de una fuente variable.

import fs from 'node:fs';
import path from 'node:path';

export function leerNombreFamilia(rutaArchivo) {
  const buf = fs.readFileSync(rutaArchivo);
  if (buf.length < 12) return null;
  const numTables = buf.readUInt16BE(4);
  let nameTableOffset = null;
  for (let i = 0; i < numTables; i++) {
    const recOffset = 12 + i * 16;
    if (recOffset + 16 > buf.length) break;
    const tag = buf.toString('ascii', recOffset, recOffset + 4);
    if (tag === 'name') {
      nameTableOffset = buf.readUInt32BE(recOffset + 8);
      break;
    }
  }
  if (nameTableOffset == null) return null;

  const count = buf.readUInt16BE(nameTableOffset + 2);
  const stringOffset = buf.readUInt16BE(nameTableOffset + 4);
  const storageStart = nameTableOffset + stringOffset;

  function decodificar(platformID, start, length) {
    if (platformID === 1) return buf.toString('latin1', start, start + length);
    // Windows (3) o Unicode (0): UTF-16BE. Node no lo decodifica nativo,
    // así que invertimos los bytes y leemos como UTF-16LE.
    const swapped = Buffer.alloc(length);
    for (let j = 0; j + 1 < length; j += 2) {
      swapped[j] = buf[start + j + 1];
      swapped[j + 1] = buf[start + j];
    }
    return swapped.toString('utf16le');
  }

  const porNameId = {};
  for (let i = 0; i < count; i++) {
    const recOffset = nameTableOffset + 6 + i * 12;
    if (recOffset + 12 > buf.length) break;
    const platformID = buf.readUInt16BE(recOffset);
    const nameID = buf.readUInt16BE(recOffset + 6);
    const length = buf.readUInt16BE(recOffset + 8);
    const offset = buf.readUInt16BE(recOffset + 10);
    if (nameID !== 1 && nameID !== 4) continue;
    const start = storageStart + offset;
    if (start + length > buf.length) continue;
    // Plataforma Windows (3) es la más consistente entre fuentes.
    if (porNameId[nameID] && platformID !== 3) continue;
    porNameId[nameID] = decodificar(platformID, start, length);
  }
  // nameID 1 (family name clásico) es lo que libass/FreeType usan para
  // emparejar por nombre; nameID 4 (full name) es el último recurso.
  return porNameId[1] || porNameId[4] || null;
}

export function listarFuentesEnCarpetas(carpetas) {
  const resultado = [];
  for (const carpeta of carpetas) {
    if (!carpeta || !fs.existsSync(carpeta)) continue;
    for (const archivo of fs.readdirSync(carpeta)) {
      if (!/\.(ttf|otf)$/i.test(archivo)) continue;
      const ruta = path.join(carpeta, archivo);
      try {
        const familia = leerNombreFamilia(ruta);
        if (familia) resultado.push({ archivo: ruta, familia });
      } catch {
        // archivo corrupto o no-sfnt: se ignora
      }
    }
  }
  return resultado;
}

function normalizar(s) {
  return String(s || '').toLowerCase().replace(/[\s-]/g, '');
}

// Busca por nombre de familia (coincidencia exacta primero) en el orden de
// carpetas dado; la primera carpeta gana si hay nombres repetidos (así las
// fuentes propias del alumno en fuentes/ pueden pisar a las del plugin).
export function resolverFuentePorNombre(nombreBuscado, carpetas) {
  const disponibles = listarFuentesEnCarpetas(carpetas);
  const clave = normalizar(nombreBuscado);
  if (!clave) return null;
  return disponibles.find((f) => normalizar(f.familia) === clave) || null;
}
