import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: host || '0.0.0.0',
    port: 1420,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/.cargo/**', '**/.rustup/**', '**/src-tauri/target/**', '**/dist/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        hud: fileURLToPath(new URL('./hud.html', import.meta.url)),
        quickAdd: fileURLToPath(new URL('./quick-add.html', import.meta.url)),
      },
    },
  },
});
