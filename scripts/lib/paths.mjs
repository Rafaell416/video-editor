// Utilidades compartidas para encontrar ffmpeg/ffprobe/whisper-cli y el
// modelo de whisper en el sistema. check.mjs y transcribe.mjs usan la
// misma lógica para no divergir sobre qué significa "está instalado".

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function detectSystem() {
  const platform = process.platform;
  const osName = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'windows' : 'linux';
  const shell =
    osName === 'windows'
      ? process.env.PSModulePath ? 'powershell' : 'cmd'
      : process.env.SHELL || 'sh';
  return { os: osName, arch: process.arch, shell };
}

export const system = detectSystem();
export const LOCALAPPDATA = process.env.LOCALAPPDATA || '';
export const HOME = os.homedir();

function whichOnPath(name) {
  const cmd = system.os === 'windows' ? 'where' : 'which';
  const res = spawnSync(cmd, [name], { encoding: 'utf8' });
  if (res.status === 0 && res.stdout) {
    const first = res.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
    if (first) return first;
  }
  return null;
}

export function findExecutable(name, extraCandidates = []) {
  const fromPath = whichOnPath(name);
  if (fromPath) return { path: fromPath, origen: 'PATH' };
  for (const candidate of extraCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      return { path: candidate, origen: 'ruta conocida' };
    }
  }
  return null;
}

export function candidatesFor(name) {
  const exe = system.os === 'windows' ? `${name}.exe` : name;
  if (system.os === 'mac') {
    const candidatos = [`/opt/homebrew/bin/${exe}`, `/usr/local/bin/${exe}`];
    // ffmpeg-full (el que trae libass) queda siempre "keg-only": nunca se
    // enlaza solo al PATH, ni en una Mac recién instalada.
    if (name === 'ffmpeg' || name === 'ffprobe') candidatos.push(`/opt/homebrew/opt/ffmpeg-full/bin/${exe}`);
    return candidatos;
  }
  if (system.os === 'windows') {
    return [
      LOCALAPPDATA ? path.join(LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', exe) : null,
      'C:\\Program Files\\Git\\bin\\git.exe',
    ];
  }
  return [`/usr/local/bin/${exe}`, `/usr/bin/${exe}`];
}

export function whisperCandidates() {
  const nombreBin = system.os === 'windows' ? 'whisper-cli.exe' : 'whisper-cli';
  if (system.os === 'windows') {
    return [LOCALAPPDATA ? path.join(LOCALAPPDATA, 'video-editor', 'whisper', nombreBin) : null];
  }
  return ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli'];
}

export function findWhisper() {
  return findExecutable('whisper-cli', whisperCandidates());
}

function tieneFiltroAss(ffmpegPath) {
  const res = spawnSync(ffmpegPath, ['-filters'], { encoding: 'utf8', timeout: 10_000 });
  return /render ass subtitles/i.test(res.stdout || '');
}

export function findFfmpeg() {
  const principal = findExecutable('ffmpeg', candidatesFor('ffmpeg'));
  if (!principal) return null;
  if (tieneFiltroAss(principal.path)) return principal;
  // En Mac, el ffmpeg normal de Homebrew NO incluye libass (queda fuera a
  // propósito y se instala aparte como "ffmpeg-full"); sin esto, el filtro
  // "ass" de captions/render falla aunque ffmpeg "esté instalado".
  if (system.os === 'mac') {
    const completo = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';
    if (fs.existsSync(completo) && tieneFiltroAss(completo)) {
      return { path: completo, origen: 'ffmpeg-full (el de Homebrew no trae subtítulos)' };
    }
  }
  return principal; // sin libass: todo funciona salvo quemar subtítulos
}

export function ffmpegTieneSubtitulos(ffmpegPath) {
  return tieneFiltroAss(ffmpegPath);
}

export function findFfprobe() {
  return findExecutable('ffprobe', candidatesFor('ffprobe'));
}

export function modelosDir() {
  if (process.env.VIDEO_EDITOR_MODELOS_DIR) return process.env.VIDEO_EDITOR_MODELOS_DIR;
  if (system.os === 'windows') return path.join(LOCALAPPDATA, 'video-editor', 'modelos');
  return path.join(HOME, '.video-editor', 'modelos');
}

export function rutaModelo(nombre = 'ggml-small.bin') {
  return path.join(modelosDir(), nombre);
}

export function runVersion(execPath, args = ['--version']) {
  // Algunas versiones de ffmpeg/whisper-cli devuelven un código de salida
  // distinto de 0 incluso cuando sí imprimieron la versión; por eso no se
  // filtra por status, solo se toma la primera línea con contenido.
  const res = spawnSync(execPath, args, { encoding: 'utf8', timeout: 10_000 });
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
  return out.split(/\r?\n/).find((l) => l.trim()) || null;
}
