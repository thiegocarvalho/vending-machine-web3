import { hasWebGL2, showWebGLError } from './render/webglCheck.js';

if (hasWebGL2()) await import('./game.js');
else showWebGLError();
