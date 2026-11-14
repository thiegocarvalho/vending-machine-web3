import { defineConfig, loadEnv } from 'vite';
import { rmSync } from 'node:fs';

// Alvos: Chrome/Brave (Chromium 89+), Firefox 89+, Safari/iOS 15+ (top-level await e createImageBitmap).
// URL pública do site (ex.: https://usuario.github.io/repositorio/) para as meta tags de compartilhamento; vazio = caminho relativo.
const siteUrl = (mode) => { const u = loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || ''; return u && !u.endsWith('/') ? u + '/' : u; };

// Trava de segurança: um build de produção nunca sai sem contrato real nem apontando para a rede local.
const guard = (mode) => {
  const e = loadEnv(mode, process.cwd(), 'VITE_');
  const erros = [];
  if (!/^0x[0-9a-fA-F]{40}$/.test(e.VITE_CONTRACT_ADDRESS || '')) erros.push('VITE_CONTRACT_ADDRESS vazio ou inválido (sem contrato o jogo cairia no modo demo)');
  if (e.VITE_CHAIN_ID === '31337' || /127\.0\.0\.1|localhost/.test(e.VITE_RPC_URL || '')) erros.push('a configuração aponta para a rede local (31337 / localhost)');
  if (erros.length) throw new Error('Build de produção bloqueado:\n - ' + erros.join('\n - ') + '\nPreencha .env.production (ou as variáveis do repositório) com os dados da Sepolia.');
};

export default defineConfig(({ mode, command }) => {
  if (command === 'build' && mode === 'production') guard(mode);
  return {
  base: './',                            // funciona em github.io/<repo>/ e em qualquer pasta
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
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 4096
  }
  };
});
