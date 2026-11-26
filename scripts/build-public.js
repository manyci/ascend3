'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'ASCEND');
const OUT_DIR = path.join(ROOT, 'public');

const RUNTIME_FILES = ['index.html'];
const RUNTIME_DIRS = ['css', 'js', 'fonts', 'assets'];
const FORBIDDEN_TOP_LEVEL = ['tests', 'exports', 'docs', 'design-reference', 'PROJECT_STATUS.md', 'README.md', 'UPLOAD_README.md'];

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function collectRuntimeReferences(baseDir) {
  const refs = new Set();

  const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const val = m[1].trim();
    if (!val || val.startsWith('#') || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) continue;
    refs.add(val);
  }

  const css = fs.readFileSync(path.join(baseDir, 'css/styles.css'), 'utf8');
  for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const val = m[1].trim();
    if (!val || val.startsWith('#') || val.startsWith('%23') || val.startsWith('data:') || val.startsWith('http://') || val.startsWith('https://')) continue;
    refs.add(val);
  }

  const chatStore = fs.readFileSync(path.join(baseDir, 'js/chat-store.js'), 'utf8');
  for (const m of chatStore.matchAll(/avatar:\s*["']([^"']+)["']/g)) {
    refs.add(m[1].trim());
  }

  const views = fs.readFileSync(path.join(baseDir, 'js/views.js'), 'utf8');
  for (const m of views.matchAll(/["'](\/(?:assets|design-reference)\/[^"']+\.(?:jpg|jpeg|png|webp|svg))["']/g)) {
    refs.add(m[1].trim());
  }
  for (const m of views.matchAll(/["']((?:assets|design-reference)\/[^"']+\.(?:jpg|jpeg|png|webp|svg))["']/g)) {
    refs.add(m[1].trim());
  }

  // Verify dynamic category card paths (/assets/cats/<id>.jpg) from data.js
  const dataJs = fs.readFileSync(path.join(baseDir, 'js/data.js'), 'utf8');
  const catsBlock = dataJs.match(/LM\.CATEGORIES\s*=\s*\[([\s\S]*?)\];/);
  if (catsBlock) {
    for (const m of catsBlock[1].matchAll(/id:\s*["']([a-z0-9-]+)["']/g)) {
      refs.add(`/assets/cats/${m[1]}.jpg`);
    }
  }

  return Array.from(refs).sort();
}

function resolveRefToDisk(baseDir, ref) {
  if (ref.startsWith('/')) {
    return path.join(baseDir, ref.slice(1));
  }
  if (ref.startsWith('../')) {
    return path.join(baseDir, ref.replace(/^\.\.\//, ''));
  }
  return path.join(baseDir, ref);
}

function main() {
  if (!fs.existsSync(path.join(SRC_DIR, 'index.html'))) {
    throw new Error(`Missing source entrypoint: ${path.join(SRC_DIR, 'index.html')}`);
  }

  // Refresh generated runtime files without deleting deploy-uploaded public assets.
  // Vercel snapshots public/ before running the build; deleting a pre-uploaded file
  // here can make its later upload stream fail with ENOENT. Keep aistudio assets
  // that exist only in public/ and rebuild the app-owned runtime directories.
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const file of RUNTIME_FILES) {
    const src = path.join(SRC_DIR, file);
    if (!fs.existsSync(src)) throw new Error(`Missing required runtime file: ${src}`);
    fs.rmSync(path.join(OUT_DIR, file), { force: true });
    fs.copyFileSync(src, path.join(OUT_DIR, file));
  }

  for (const dir of RUNTIME_DIRS) {
    const src = path.join(SRC_DIR, dir);
    const dest = path.join(OUT_DIR, dir);
    if (!fs.existsSync(src)) throw new Error(`Missing required runtime directory: ${src}`);

    if (dir === 'assets') {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
        if (entry.name === 'aistudio') continue;
        fs.rmSync(path.join(dest, entry.name), { recursive: true, force: true });
      }
    } else {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDirRecursive(src, dest);
  }

  // Ensure forbidden non-runtime artifacts are not present in public/
  for (const forbidden of [...FORBIDDEN_TOP_LEVEL, 'assets/aistudio']) {
    const target = path.join(OUT_DIR, forbidden);
    if (fs.existsSync(target)) {
      throw new Error(`Forbidden non-runtime path found in public/: ${target}`);
    }
  }

  const refs = collectRuntimeReferences(OUT_DIR);
  const broken = [];
  const designRefs = [];
  const relativeRefs = [];

  for (const ref of refs) {
    if (ref.includes('design-reference')) designRefs.push(ref);
    if (!ref.startsWith('/')) relativeRefs.push(ref);

    const outDisk = resolveRefToDisk(OUT_DIR, ref);
    const srcDisk = resolveRefToDisk(SRC_DIR, ref);
    if (!fs.existsSync(outDisk) || !fs.existsSync(srcDisk)) {
      broken.push({ ref, outExists: fs.existsSync(outDisk), srcExists: fs.existsSync(srcDisk) });
    }
  }

  if (designRefs.length) {
    throw new Error(`Runtime code still references design-reference/: ${designRefs.join(', ')}`);
  }
  if (relativeRefs.length) {
    throw new Error(`Non-root-relative runtime paths detected (unsafe for SPA fallback): ${relativeRefs.join(', ')}`);
  }
  if (broken.length) {
    throw new Error(`Broken static references detected: ${JSON.stringify(broken)}`);
  }

  console.log(`[build-public] Built public/ from ASCEND/ (${refs.length} runtime references verified, 0 broken, 0 design-reference links).`);
}

main();
