import { hasWebGL2, showWebGLError } from './render/webglCheck.js';

if (hasWebGL2()) {
  try { await import('./game.js'); }
  catch (e) {
    if (/WebGL/i.test(e?.message || '')) showWebGLError(); else throw e;
  }
} else showWebGLError();
