import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    port: 1420,
    strictPort: true,
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
        main: new URL('./index.html', import.meta.url).pathname,
        hud: new URL('./hud.html', import.meta.url).pathname,
        quickAdd: new URL('./quick-add.html', import.meta.url).pathname,
      },
    },
  },
});
