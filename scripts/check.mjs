// Diagnóstico del sistema: detecta ffmpeg, whisper, node, git y yt-dlp,
// prueba cada uno de verdad (no solo --version) y, si algo falta, devuelve
// el comando de instalación recomendado para este sistema operativo.
//
// Uso:
//   node scripts/check.mjs            → tabla legible
//   node scripts/check.mjs --json     → JSON a stdout
//
// Exit code: 0 si ffmpeg + ffprobe + whisper + node están ok, 1 si falta alguno.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const asJson = process.argv.includes('--json');

// ---------------------------------------------------------------------------
// Sistema
// ---------------------------------------------------------------------------

function detectSystem() {
  const platform = process.platform;
  const osName = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : 'linux';
  const shell =
    osName === 'windows'
      ? process.env.PSModulePath ? 'powershell' : 'cmd'
      : process.env.SHELL || 'sh';
  return { os: osName, arch: process.arch, shell };
}

const system = detectSystem();
const LOCALAPPDATA = process.env.LOCALAPPDATA || '';
const HOME = os.homedir();

// ---------------------------------------------------------------------------
// Búsqueda de ejecutables: PATH primero, luego rutas típicas por sistema
// (cubre el caso de que winget/brew acaben de instalar algo y la PATH del
// proceso actual todavía no se haya refrescado).
// ---------------------------------------------------------------------------

function whichOnPath(name) {
  const cmd = system.os === 'windows' ? 'where' : 'which';
  const res = spawnSync(cmd, [name], { encoding: 'utf8' });
  if (res.status === 0 && res.stdout) {
    const first = res.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
    if (first) return first;
  }
  return null;
}

function findExecutable(name, extraCandidates = []) {
  const fromPath = whichOnPath(name);
  if (fromPath) return { path: fromPath, origen: 'PATH' };
  for (const candidate of extraCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      return { path: candidate, origen: 'ruta conocida' };
    }
  }
  return null;
}

function candidatesFor(name) {
  const exe = system.os === 'windows' ? `${name}.exe` : name;
  if (system.os === 'mac') {
    return [`/opt/homebrew/bin/${exe}`, `/usr/local/bin/${exe}`];
  }
  if (system.os === 'windows') {
    return [
      LOCALAPPDATA ? path.join(LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', exe) : null,
      'C:\\Program Files\\Git\\bin\\git.exe',
    ];
  }
  return [`/usr/local/bin/${exe}`, `/usr/bin/${exe}`];
}

function runVersion(execPath, args = ['--version']) {
  // Algunas versiones de ffmpeg/whisper-cli devuelven un código de salida
  // distinto de 0 incluso cuando sí imprimieron la versión; por eso no se
  // filtra por status, solo se toma la primera línea con contenido.
  const res = spawnSync(execPath, args, { encoding: 'utf8', timeout: 10_000 });
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
  return out.split(/\r?\n/).find((l) => l.trim()) || null;
}

// ---------------------------------------------------------------------------
// Carpeta temporal y clip de prueba (testsrc + sine) para probar ffmpeg,
// ffprobe y whisper con un archivo real, no solo con --version.
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-editor-check-'));
const testClip = path.join(tmpDir, 'prueba.mp4');
const testWav = path.join(tmpDir, 'prueba.wav');

function cleanupTmp() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // no-op: es un directorio temporal, no pasa nada si queda
  }
}

// ---------------------------------------------------------------------------
// ffmpeg / ffprobe
// ---------------------------------------------------------------------------

function checkFfmpeg() {
  const found = findExecutable('ffmpeg', candidatesFor('ffmpeg'));
  const resultado = {
    found: Boolean(found),
    version: null,
    path: found?.path || null,
    ok: false,
    test: { descripcion: 'generar un clip de prueba de 2 s (video + audio sintéticos)', paso: false, detalle: null },
  };
  if (!found) {
    resultado.test.detalle = 'ffmpeg no está instalado';
    return resultado;
  }
  resultado.version = runVersion(found.path);

  const gen = spawnSync(
    found.path,
    [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=2',
      '-shortest',
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac',
      testClip,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );
  const clipListo = gen.status === 0 && fs.existsSync(testClip) && fs.statSync(testClip).size > 0;
  resultado.test.paso = clipListo;
  resultado.ok = clipListo;
  if (!clipListo) resultado.test.detalle = (gen.stderr || 'no se generó el clip de prueba').trim().split(/\r?\n/).pop();
  return resultado;
}

function checkFfprobe(ffmpegOk) {
  const found = findExecutable('ffprobe', candidatesFor('ffprobe'));
  const resultado = {
    found: Boolean(found),
    version: null,
    path: found?.path || null,
    ok: false,
    test: { descripcion: 'leer la duración del clip de prueba generado por ffmpeg', paso: false, detalle: null },
  };
  if (!found) {
    resultado.test.detalle = 'ffprobe no está instalado';
    return resultado;
  }
  resultado.version = runVersion(found.path);
  if (!ffmpegOk) {
    resultado.test.detalle = 'no se pudo probar: ffmpeg no generó el clip de prueba';
    return resultado;
  }
  const probe = spawnSync(
    found.path,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', testClip],
    { encoding: 'utf8', timeout: 10_000 },
  );
  let duracion = null;
  try {
    duracion = Number(JSON.parse(probe.stdout || '{}').format?.duration);
  } catch {
    duracion = null;
  }
  const leido = probe.status === 0 && Number.isFinite(duracion) && duracion > 1 && duracion < 4;
  resultado.test.paso = leido;
  resultado.ok = leido;
  if (!leido) resultado.test.detalle = (probe.stderr || 'no se pudo leer la duración del clip').trim();
  return resultado;
}

// ---------------------------------------------------------------------------
// whisper (whisper.cpp) + modelo
// ---------------------------------------------------------------------------

function modelosDir() {
  if (process.env.VIDEO_EDITOR_MODELOS_DIR) return process.env.VIDEO_EDITOR_MODELOS_DIR;
  if (system.os === 'windows') return path.join(LOCALAPPDATA, 'video-editor', 'modelos');
  return path.join(HOME, '.video-editor', 'modelos');
}

function checkWhisper(ffmpegOk) {
  const nombreBin = system.os === 'windows' ? 'whisper-cli.exe' : 'whisper-cli';
  const candidatosWhisper =
    system.os === 'windows'
      ? [LOCALAPPDATA ? path.join(LOCALAPPDATA, 'video-editor', 'whisper', nombreBin) : null]
      : ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli'];

  const found = findExecutable('whisper-cli', candidatosWhisper);
  const dirModelos = modelosDir();
  const modeloSmall = path.join(dirModelos, 'ggml-small.bin');
  const modeloLarge = path.join(dirModelos, 'ggml-large-v3-turbo.bin');

  const resultado = {
    found: Boolean(found),
    version: null,
    path: found?.path || null,
    ok: false,
    modelo: {
      carpeta: dirModelos,
      small: { found: fs.existsSync(modeloSmall), path: modeloSmall },
      large: { found: fs.existsSync(modeloLarge), path: modeloLarge },
    },
    test: { descripcion: 'transcribir el audio sintético del clip de prueba', paso: false, detalle: null },
  };

  if (!found) {
    resultado.test.detalle = 'whisper-cli no está instalado';
    return resultado;
  }
  resultado.version = runVersion(found.path, ['--help']); // whisper.cpp no tiene --version estable; --help confirma que corre

  if (!resultado.modelo.small.found) {
    resultado.test.detalle = `falta el modelo en ${modeloSmall}`;
    return resultado;
  }
  if (!ffmpegOk) {
    resultado.test.detalle = 'no se pudo probar: ffmpeg no generó el audio de prueba';
    return resultado;
  }

  const ffmpegFound = findExecutable('ffmpeg', candidatesFor('ffmpeg'));
  const wav = spawnSync(
    ffmpegFound.path,
    ['-y', '-i', testClip, '-ar', '16000', '-ac', '1', '-f', 'wav', testWav],
    { encoding: 'utf8', timeout: 15_000 },
  );
  if (wav.status !== 0 || !fs.existsSync(testWav)) {
    resultado.test.detalle = 'no se pudo extraer el audio de prueba a wav';
    return resultado;
  }

  const transc = spawnSync(
    found.path,
    ['-m', modeloSmall, '-f', testWav, '-nt', '-np'],
    { encoding: 'utf8', timeout: 60_000 },
  );
  const corrio = transc.status === 0;
  resultado.test.paso = corrio;
  resultado.ok = corrio;
  if (!corrio) resultado.test.detalle = (transc.stderr || 'whisper-cli no terminó correctamente').trim().split(/\r?\n/).pop();
  return resultado;
}

// ---------------------------------------------------------------------------
// node, git, yt-dlp
// ---------------------------------------------------------------------------

function checkNode() {
  const version = process.version; // el mismo node que corre este script
  const mayor = Number(version.replace('v', '').split('.')[0]);
  return {
    found: true,
    version,
    path: process.execPath,
    ok: mayor >= 22,
    test: { descripcion: 'versión del proceso en ejecución', paso: mayor >= 22, detalle: mayor >= 22 ? null : 'se requiere Node 22 o superior' },
  };
}

function checkOpcional(name, candidates) {
  const found = findExecutable(name, candidates);
  return {
    found: Boolean(found),
    version: found ? runVersion(found.path) : null,
    path: found?.path || null,
    ok: null, // opcional: no cuenta para el resultado final
  };
}

// ---------------------------------------------------------------------------
// Comandos de instalación recomendados (strings, nunca se ejecutan aquí)
// ---------------------------------------------------------------------------

function comandosInstalacion() {
  const dirModelos = modelosDir();
  const urlsModelos = {
    small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    large: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    destino: dirModelos,
  };
  return {
    mac: {
      homebrew: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      ffmpeg: 'brew install ffmpeg',
      whisper: 'brew install whisper.cpp',
      node: 'brew install node',
      ytdlp: 'brew install yt-dlp',
    },
    windows: {
      ffmpeg: 'winget install --id Gyan.FFmpeg -e',
      node: 'winget install --id OpenJS.NodeJS.LTS -e',
      ytdlp: 'winget install --id yt-dlp.yt-dlp -e',
      whisper: `Descargar el .zip de binarios para Windows x64 desde https://github.com/ggerganov/whisper.cpp/releases/latest y descomprimirlo en ${path.join(LOCALAPPDATA || '%LOCALAPPDATA%', 'video-editor', 'whisper')}`,
    },
    modelos: urlsModelos,
  };
}

// ---------------------------------------------------------------------------
// Ejecutar todo
// ---------------------------------------------------------------------------

const ffmpeg = checkFfmpeg();
const ffprobe = checkFfprobe(ffmpeg.ok);
const whisper = checkWhisper(ffmpeg.ok);
const node = checkNode();
const git = checkOpcional('git', system.os === 'windows' ? ['C:\\Program Files\\Git\\bin\\git.exe'] : []);
const ytdlp = checkOpcional('yt-dlp', candidatesFor('yt-dlp'));

cleanupTmp();

const ok = ffmpeg.ok && ffprobe.ok && whisper.ok && node.ok;

const resultado = {
  system,
  tools: { ffmpeg, ffprobe, whisper, node, git, ytdlp },
  install: comandosInstalacion(),
  ok,
};

if (asJson) {
  console.log(JSON.stringify(resultado, null, 2));
  process.exit(ok ? 0 : 1);
}

const PARA_QUE = {
  ffmpeg: 'cortar, convertir y renderizar el video',
  ffprobe: 'leer datos del video (duración, resolución, fps)',
  whisper: 'transcribir lo que dices para encontrar silencios y cortes',
  node: 'correr los scripts del editor',
  git: 'opcional, para actualizar el plugin',
  ytdlp: 'opcional, para traer videos de referencia de internet',
};

function estado(info) {
  if (info.ok === null) return info.found ? '✓' : '·'; // opcional
  return info.ok ? '✓' : '✗';
}

console.log(`Sistema: ${system.os} (${system.arch}), shell: ${system.shell}\n`);
console.log('Herramienta   Estado  Para qué sirve');
for (const [nombre, info] of Object.entries(resultado.tools)) {
  console.log(`${nombre.padEnd(13)} ${estado(info).padEnd(7)} ${PARA_QUE[nombre]}`);
  if (info.ok === false && info.test?.detalle) {
    console.log(`              ↳ ${info.test.detalle}`);
  }
}
console.log();
console.log(ok ? 'Todo listo.' : 'Falta instalar algo (ver arriba).');

process.exit(ok ? 0 : 1);
