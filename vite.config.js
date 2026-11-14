import { defineConfig } from 'vite';

// Alvos: Chrome/Brave (Chromium 89+), Firefox 89+, Safari/iOS 15+ (top-level await e createImageBitmap).
export default defineConfig({
  build: {
    target: ['es2022', 'chrome89', 'firefox89', 'safari15'],
    chunkSizeWarningLimit: 700,
    sourcemap: false
  }
});
