import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function sha256(file) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(file, 'r'), buffer = Buffer.alloc(4 * 1024 * 1024);
  try { let size; while ((size = fs.readSync(handle, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, size)); }
  finally { fs.closeSync(handle); }
  return hash.digest('hex');
}

export function assembleComponent(root, manifest) {
  const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  if (manifest.format !== 1 || !/^[A-Za-z0-9.-]+\.exe$/.test(manifest.output || '') ||
      !hex(manifest.sha256) || !Number.isSafeInteger(manifest.size) || manifest.size <= 0 ||
      !Array.isArray(manifest.parts) || !manifest.parts.length || manifest.parts.length > 16)
    throw Error('Invalid offline component manifest. / Неверный манифест компонента.');
  let total = 0;
  for (const part of manifest.parts) {
    if (!/^[A-Za-z0-9.-]+\.bin$/.test(part.name || '') || !hex(part.sha256) ||
        !Number.isSafeInteger(part.size) || part.size <= 0 || part.size >= 100 * 1024 * 1024)
      throw Error('Invalid offline component part. / Неверная часть компонента.');
    total += part.size;
  }
  if (total !== manifest.size || new Set(manifest.parts.map(p => p.name)).size !== manifest.parts.length)
    throw Error('Invalid offline component size or duplicate part.');
  const output = path.join(root, 'runtime', manifest.output);
  if (fs.existsSync(output)) {
    if (fs.statSync(output).size !== manifest.size || sha256(output) !== manifest.sha256)
      throw Error('Offline installer is damaged. Extract a clean copy. / Установщик повреждён. Распакуйте чистую копию.');
    return output;
  }
  const temporary = output + '.preparing-' + crypto.randomUUID();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const handle = fs.openSync(temporary, 'wx'), buffer = Buffer.alloc(4 * 1024 * 1024);
  let complete = false;
  try {
    for (const part of manifest.parts) {
      const file = path.join(root, 'distribution', 'components', part.name);
      if (!fs.existsSync(file) || fs.statSync(file).size !== part.size || sha256(file) !== part.sha256)
        throw Error('Missing or damaged offline component: ' + part.name + '. Extract the whole ZIP. / Распакуйте весь ZIP.');
      const input = fs.openSync(file, 'r');
      try {
        let size;
        while ((size = fs.readSync(input, buffer, 0, buffer.length, null))) {
          let offset = 0;
          while (offset < size) offset += fs.writeSync(handle, buffer, offset, size - offset);
        }
      } finally { fs.closeSync(input); }
    }
    complete = true;
  } finally {
    fs.closeSync(handle);
    if (!complete) fs.unlinkSync(temporary);
  }
  try {
    if (fs.statSync(temporary).size !== manifest.size || sha256(temporary) !== manifest.sha256)
      throw Error('Combined offline component checksum mismatch.');
    fs.renameSync(temporary, output);
    return output;
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function webViewInstalled() {
  const client = 'Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  return ['HKLM', 'HKCU'].some(hive => {
    const result = spawnSync('reg.exe', ['query', hive + '\\' + client, '/v', 'pv', '/reg:32'],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    return result.status === 0 && /\bpv\s+REG_SZ\s+[1-9]\d*\./i.test(result.stdout || '');
  });
}

export function verifyPackage(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'distribution', 'package-files.json'), 'utf8'));
  if (manifest.format !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw Error('Invalid package inventory.');
  const base = path.resolve(root) + path.sep;
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || entry.path.includes('\\') || entry.path.split('/').some(p => !p || p === '..' || p === '.')) throw Error('Invalid inventory path.');
    const file = path.resolve(root, entry.path);
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).size !== entry.size || sha256(file) !== entry.sha256)
      throw Error('Missing or damaged package file: ' + entry.path);
  }
  return manifest.files.length;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.includes('--verify-package')) {
    console.log('Verified files: ' + verifyPackage(root));
    return;
  }
  if (process.argv.includes('--assemble-component')) {
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts','offline-components.json'),'utf8'));
    assembleComponent(root,manifest);
    console.log('Offline component verified. Installer was not executed.');
    return;
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Windows 10/11 x64 is required.');
  const checkout = JSON.parse(fs.readFileSync(path.join(root, 'distribution', 'checkout.json'), 'utf8'));
  if (checkout.format !== 1 || typeof checkout.requiresWebView !== 'boolean' ||
      !/^[A-Za-z0-9 ._-]+\.exe$/.test(checkout.launcher || '') || path.basename(checkout.launcher) !== checkout.launcher)
    throw Error('Invalid checkout descriptor.');
  for (const relative of ['public/data/maps.json', 'node_modules/linkedom/package.json', checkout.launcher])
    if (!fs.existsSync(path.join(root, relative))) throw Error('Incomplete app folder: ' + relative + '. Extract the entire ZIP. / Распакуйте весь ZIP.');
  if (checkout.requiresWebView && !webViewInstalled()) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'offline-components.json'), 'utf8'));
    const installer = assembleComponent(root, manifest);
    // The original Microsoft installer handles its own UI and any elevation request.
    const result = spawnSync(installer, ['/install'], { stdio: 'inherit', windowsHide: false });
    if (result.error) throw result.error;
    if (![0, 3010].includes(result.status) || !webViewInstalled())
      throw Error('WebView2 is not ready. Finish Microsoft setup, restart Windows if requested, then try again. / Завершите установку WebView2 и повторите запуск.');
  }
  if (process.argv.includes('--launch')) {
    const child = spawn(path.join(root, checkout.launcher), [], { cwd: root, detached: true, stdio: 'ignore' });
    await new Promise((resolve,reject) => { child.once('spawn',resolve); child.once('error',reject); });
    child.unref();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
