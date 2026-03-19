import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const repoCargoHome = path.join(repoRoot, '.cargo');
const repoRustupHome = path.join(repoRoot, '.rustup');
const cargoHome = process.env.CARGO_HOME || repoCargoHome;
const rustupHome = process.env.RUSTUP_HOME || repoRustupHome;
const cargoBinDir = path.join(cargoHome, 'bin');
const cargoBinary = path.join(cargoBinDir, process.platform === 'win32' ? 'cargo.exe' : 'cargo');
const rustupBinary = path.join(cargoBinDir, process.platform === 'win32' ? 'rustup.exe' : 'rustup');
const localTauriEntry = path.join(
  repoRoot,
  'node_modules',
  '@tauri-apps',
  'cli',
  'tauri.js',
);
const SYSTEM_XDG_DATA_DIRS = '/usr/local/share:/usr/share';

function isSnapBackedValue(value) {
  return typeof value === 'string' && (value.includes('/snap/') || value.includes('/var/lib/snapd/'));
}

function sanitizeLinuxDesktopEnv(sourceEnv) {
  if (process.platform !== 'linux') {
    return { ...sourceEnv };
  }

  const nextEnv = { ...sourceEnv };
  const keysToStrip = [
    'GTK_PATH',
    'GIO_MODULE_DIR',
    'GDK_PIXBUF_MODULEDIR',
    'GDK_PIXBUF_MODULE_FILE',
    'GTK_EXE_PREFIX',
    'GTK_DATA_PREFIX',
    'GTK_IM_MODULE_FILE',
    'GI_TYPELIB_PATH',
  ];

  for (const [key, value] of Object.entries(nextEnv)) {
    if (key === 'SNAP' || key.startsWith('SNAP_')) {
      delete nextEnv[key];
      continue;
    }

    if (keysToStrip.includes(key) && isSnapBackedValue(value)) {
      delete nextEnv[key];
    }
  }

  const dataDirs = nextEnv.XDG_DATA_DIRS
    ?.split(path.delimiter)
    .filter(Boolean)
    .filter((entry) => !isSnapBackedValue(entry));

  if (dataDirs && dataDirs.length > 0) {
    nextEnv.XDG_DATA_DIRS = dataDirs.join(path.delimiter);
  } else {
    nextEnv.XDG_DATA_DIRS = SYSTEM_XDG_DATA_DIRS;
  }

  return nextEnv;
}

function printRustHelp() {
  console.error('');
  console.error('MissionControl could not find a Rust toolchain for Tauri.');
  console.error('');
  console.error('Expected one of these to exist:');
  console.error(`- ${cargoBinary}`);
  console.error('- cargo in your global PATH');
  console.error('');
  console.error('Fix options:');
  console.error('1. Install Rust globally with rustup and reopen your shell');
  console.error('2. Or install the repo-local toolchain used by this project');
  console.error('');
}

function printTauriHelp() {
  console.error('');
  console.error('MissionControl could not find the local Tauri CLI entrypoint.');
  console.error('');
  console.error(`Expected: ${localTauriEntry}`);
  console.error('');
  console.error('Fix options:');
  console.error('1. Run npm install to restore node_modules');
  console.error('2. Or install the Tauri CLI globally and rerun the command');
  console.error('');
}

const hasRepoToolchain = existsSync(cargoBinary) || existsSync(rustupBinary);
const env = sanitizeLinuxDesktopEnv({
  ...process.env,
  PATH: [cargoBinDir, process.env.PATH].filter(Boolean).join(path.delimiter),
});

if (hasRepoToolchain) {
  env.CARGO_HOME = cargoHome;
  env.RUSTUP_HOME = rustupHome;
}

const args = process.argv.slice(2);
const tauriArgs = existsSync(localTauriEntry)
  ? [localTauriEntry, ...args]
  : args;
const tauriCommand = existsSync(localTauriEntry) ? process.execPath : 'tauri';

const child = spawn(tauriCommand, tauriArgs, {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  if (error.message.includes('ENOENT')) {
    if (!existsSync(localTauriEntry)) {
      printTauriHelp();
    } else {
      printRustHelp();
    }
  } else {
    console.error(error.message);
  }

  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
