import { defineConfig, loadEnv } from 'vite';
import { rmSync } from 'node:fs';

// Alvos: Chrome/Brave (Chromium 89+), Firefox 89+, Safari/iOS 15+ (top-level await e createImageBitmap).
// URL pública do site (ex.: https://usuario.github.io/repositorio/) para as meta tags de compartilhamento; vazio = caminho relativo.
const siteUrl = (mode) => { const u = loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || ''; return u && !u.endsWith('/') ? u + '/' : u; };

export default defineConfig(({ mode }) => ({
  plugins: [{
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl(mode))
  }, {
    name: 'drop-dev-assets',            // public/dev-images e dev-metadata são só de desenvolvimento (sem CID): não vão para o build
    apply: 'build',
    closeBundle() { for (const d of ['dev-images', 'dev-metadata']) rmSync(`dist/${d}`, { recursive: true, force: true }); }
  }],
  build: {
    target: ['es2022', 'chrome89', 'firefox89', 'safari15'],
    chunkSizeWarningLimit: 700,
    sourcemap: false
  }
}));
