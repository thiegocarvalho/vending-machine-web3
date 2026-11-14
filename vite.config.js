import { defineConfig } from 'vite';
import { rmSync } from 'node:fs';

// Alvos: Chrome/Brave (Chromium 89+), Firefox 89+, Safari/iOS 15+ (top-level await e createImageBitmap).
export default defineConfig({
  plugins: [{
    name: 'drop-dev-assets',            // public/dev-images e dev-metadata são só de desenvolvimento (sem CID): não vão para o build
    apply: 'build',
    closeBundle() { for (const d of ['dev-images', 'dev-metadata']) rmSync(`dist/${d}`, { recursive: true, force: true }); }
  }],
  build: {
    target: ['es2022', 'chrome89', 'firefox89', 'safari15'],
    chunkSizeWarningLimit: 700,
    sourcemap: false
  }
});
