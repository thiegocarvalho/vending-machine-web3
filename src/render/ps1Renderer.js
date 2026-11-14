import * as THREE from 'three';
import { config } from '../config.js';

// Snaps vertices to a coarse grid in clip space (PS1 "wobble").
export function applyPs1Snap(material, grid = 160) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       vec4 snapped = gl_Position; snapped.xy = floor(snapped.xy / snapped.w * ${grid.toFixed(1)} + 0.5) / ${grid.toFixed(1)} * snapped.w; gl_Position = snapped;`
    );
  };
  return material;
}

export function createPs1Renderer(canvas) {
  // Alguns navegadores/GPUs (ex.: Brave em Linux) recusam powerPreference; tenta variações até uma funcionar.
  const attempts = [{ powerPreference: 'high-performance' }, {}, { powerPreference: 'low-power' }];
  let renderer, lastError;
  for (const extra of attempts) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, ...extra }); break; }
    catch (e) { lastError = e; }
  }
  if (!renderer) throw lastError;
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  function resize(w, h) {
    renderer.setSize(Math.max(160, Math.floor(w / config.pixelScale)), Math.max(120, Math.floor(h / config.pixelScale)), false);
  }
  return { renderer, resize, render: (scene, camera) => renderer.render(scene, camera) };
}
