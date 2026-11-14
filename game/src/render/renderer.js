import * as THREE from 'three';

// Alguns navegadores/GPUs (ex.: Brave em Linux) recusam certas opções; tenta variações até uma funcionar.
export function createRenderer(canvas, { dprCap = 1.5, antialias = false } = {}) {
  const attempts = [{ powerPreference: 'high-performance' }, {}, { powerPreference: 'low-power' }];
  const lean = { alpha: false, stencil: false };                      // menos memória de framebuffer
  let renderer, lastError;
  for (const extra of attempts) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias, ...lean, ...extra }); break; }
    catch (e) { lastError = e; }
  }
  if (!renderer) throw lastError;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  let factor = 1, lastW = 0, lastH = 0;
  const ratio = () => Math.max(0.5, Math.min(window.devicePixelRatio || 1, dprCap) * factor);
  function resize(w = lastW, h = lastH) {
    lastW = w; lastH = h;
    renderer.setPixelRatio(ratio());
    renderer.setSize(w, h, false);
  }
  // Celulares (iOS principalmente) podem derrubar o contexto WebGL em segundo plano ou com pouca memória: nada de tela preta.
  let lost = false; const restoreCbs = [];
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; resize(); restoreCbs.forEach((cb) => cb()); });

  // Resolução dinâmica: reduz/restaura a densidade de pixels sem mudar o tamanho na tela.
  function setResolutionFactor(f) { factor = f; resize(); }
  return { renderer, resize, setResolutionFactor, onRestore: (cb) => restoreCbs.push(cb), render: (scene, camera) => { if (!lost) renderer.render(scene, camera); } };
}
