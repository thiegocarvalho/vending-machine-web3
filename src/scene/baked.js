import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyPs1Snap } from '../render/ps1Renderer.js';

// Luz "assada": sem luzes dinâmicas (caras no celular), o sombreamento vira cor de vértice por orientação da face.
const AMBIENT = [0.88, 0.93, 1];          // tom frio da noite, quase neutro para não distorcer as cores da marca
const GAIN = 1;
const FACE = (n) => (n.z > 0.5 ? 1 : n.y > 0.5 ? 0.85 : n.z < -0.5 ? 0.35 : 0.55);

let shared;
export const bakedMaterial = () => (shared ??= applyPs1Snap(new THREE.MeshBasicMaterial({ vertexColors: true })));

export function bakeBox(w, h, d, hex, light = 1, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const base = [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255], n = new THREE.Vector3(), pos = geo.attributes.position, nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    const f = FACE(n) * light;
    for (let k = 0; k < 3; k++) col[i * 3 + k] = Math.pow(Math.min(1, base[k] * AMBIENT[k] * f * GAIN), 2.2);   // sRGB -> linear
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.translate(x, y, z);
  return geo;
}

// Junta muitas caixas estáticas em UM objeto (1 draw call).
export function createBatch() {
  const geos = [];
  return {
    add(...args) { geos.push(bakeBox(...args)); },
    build() { const m = new THREE.Mesh(mergeGeometries(geos, false), bakedMaterial()); geos.forEach((g) => g.dispose()); return m; }
  };
}
