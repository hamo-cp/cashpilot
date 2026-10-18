import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');

export const STAGE_ALLOWLIST_FILES = Object.freeze([
  'index.html',
  'manifest.json',
  'service-worker.js',
  'style.css',
]);

export const STAGE_ALLOWLIST_DIRS = Object.freeze([
  'files',
  'src',
  'vendor',
]);

export const STAGE_ALLOWLIST = Object.freeze([
  ...STAGE_ALLOWLIST_FILES,
  ...STAGE_ALLOWLIST_DIRS,
].sort());

export const FORBIDDEN_STAGE_ENTRIES = Object.freeze([
  '.env',
  '.git',
  '.github',
  'README.md',
  'android',
  'capacitor.config.json',
  'docs',
  'node_modules',
  'package-lock.json',
  'package.json',
  'scripts',
  'test_suite.js',
  'test_ui.js',
  'tests',
]);

function copyRuntimeFile(srcPath, destPath) {
  const bytes = fs.readFileSync(srcPath);
  if (fs.existsSync(destPath)) {
    try {
      if (fs.readFileSync(destPath).equals(bytes)) {
        return;
      }
    } catch {
      // Rewrite if existing target cannot be read
    }
  }
  fs.writeFileSync(destPath, bytes);
}

function removeExtraEntry(targetPath) {
  const stat = fs.lstatSync(targetPath);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(targetPath)) {
      removeExtraEntry(path.join(targetPath, child));
    }
    try {
      fs.rmdirSync(targetPath);
    } catch {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } else {
    fs.unlinkSync(targetPath);
  }
}

function syncDirectory(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const srcEntries = fs.readdirSync(srcDir, { withFileTypes: true });
  const srcNames = new Set(srcEntries.map(e => e.name));

  for (const existing of fs.readdirSync(destDir)) {
    if (!srcNames.has(existing)) {
      removeExtraEntry(path.join(destDir, existing));
    }
  }

  for (const entry of srcEntries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(destPath) && !fs.lstatSync(destPath).isDirectory()) {
        removeExtraEntry(destPath);
      }
      syncDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      if (fs.existsSync(destPath) && fs.lstatSync(destPath).isDirectory()) {
        removeExtraEntry(destPath);
      }
      copyRuntimeFile(srcPath, destPath);
    }
  }
}

/**
 * Deterministically stages only the approved CashPilot web runtime assets into `outDir`.
 * @param {{ rootDir?: string, outDir?: string }} [options]
 */
export function buildWeb(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT_DIR);
  const outDir = path.resolve(options.outDir || path.join(rootDir, 'www'));

  if (outDir === rootDir || (!options.allowExternalOutDir && !outDir.startsWith(rootDir + path.sep))) {
    throw new Error(`Refusing to stage outside repository root: ${outDir}`);
  }

  for (const relFile of STAGE_ALLOWLIST_FILES) {
    const srcPath = path.join(rootDir, relFile);
    if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
      throw new Error(`Missing required runtime file: ${relFile}`);
    }
  }

  for (const relDir of STAGE_ALLOWLIST_DIRS) {
    const srcPath = path.join(rootDir, relDir);
    if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory()) {
      throw new Error(`Missing required runtime directory: ${relDir}`);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const allowedSet = new Set(STAGE_ALLOWLIST);

  for (const existing of fs.readdirSync(outDir)) {
    if (!allowedSet.has(existing)) {
      removeExtraEntry(path.join(outDir, existing));
    }
  }

  for (const relFile of STAGE_ALLOWLIST_FILES) {
    const destPath = path.join(outDir, relFile);
    if (fs.existsSync(destPath) && fs.lstatSync(destPath).isDirectory()) {
      removeExtraEntry(destPath);
    }
    copyRuntimeFile(path.join(rootDir, relFile), destPath);
  }

  for (const relDir of STAGE_ALLOWLIST_DIRS) {
    const destPath = path.join(outDir, relDir);
    if (fs.existsSync(destPath) && !fs.lstatSync(destPath).isDirectory()) {
      removeExtraEntry(destPath);
    }
    syncDirectory(path.join(rootDir, relDir), destPath);
  }

  const stagedTopLevel = fs.readdirSync(outDir).sort();
  if (JSON.stringify(stagedTopLevel) !== JSON.stringify(STAGE_ALLOWLIST)) {
    throw new Error(
      `Staged top-level entries mismatch. Expected ${JSON.stringify(STAGE_ALLOWLIST)}, got ${JSON.stringify(stagedTopLevel)}`
    );
  }

  for (const forbidden of FORBIDDEN_STAGE_ENTRIES) {
    if (fs.existsSync(path.join(outDir, forbidden))) {
      throw new Error(`Forbidden entry found in staged web output: ${forbidden}`);
    }
  }

  return {
    rootDir,
    outDir,
    stagedEntries: stagedTopLevel,
  };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const result = buildWeb();
  console.log(
    `[build:web] Staged ${result.stagedEntries.length} runtime entries to ${path.relative(result.rootDir, result.outDir) || 'www'}: ${result.stagedEntries.join(', ')}`
  );
}
