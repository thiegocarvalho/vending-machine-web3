import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

const rec = () => { const calls = []; const g = new Proxy({}, { get: (t, k) => (/^create/.test(k) ? () => ({ addColorStop() {} }) : (...a) => { calls.push([k, ...a]); }), set: () => true }); return { g, calls }; };
vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => rec().g }) });
const { formatPrice, tagFor, paintTag, createPriceTags, TAG } = await import('./priceTags.js');

describe('etiquetas de preço', () => {
  it('formata o preço em ETH sem zeros sobrando', () => {
    expect(formatPrice(100000000000000n)).toBe('0.0001');
    expect(formatPrice(1500000000000000000n)).toBe('1.5');
    expect(formatPrice(123456789012345678n)).toBe('0.123456');      // cortado em 8 caracteres
    expect(formatPrice(0n)).toBe('0');
  });
  it('mostra preço, ESGOTADO ou INATIVO conforme o contrato', () => {
    expect(tagFor({ price: 100000000000000n, stock: 5, active: true })).toEqual({ kind: 'price', text: '0.0001 ETH' });
    expect(tagFor({ price: 1n, stock: 0, active: true })).toEqual({ kind: 'sold', text: 'ESGOTADO' });
    expect(tagFor({ price: 1n, stock: 0, active: false }).kind).toBe('sold');           // sem estoque vence "inativo"
    expect(tagFor({ price: 1n, stock: 7, active: false })).toEqual({ kind: 'off', text: 'INATIVO' });
    expect(tagFor({ price: 0n, stock: 0, active: false, missing: true })).toEqual({ kind: 'off', text: 'SEM CARD' });
    expect(tagFor(undefined).kind).toBe('price');
  });
  it('as três etiquetas pintam sem erro e cabem na célula', () => {
    for (const [k, t] of [['price', '0.0001 ETH'], ['sold', 'ESGOTADO'], ['off', 'INATIVO']]) {
      const { g, calls } = rec(); expect(() => paintTag(g, k, t, 0, 0)).not.toThrow();
      const xs = calls.filter((c) => c[0] === 'fillRect').map((c) => c[1]); expect(Math.max(...xs)).toBeLessThanOrEqual(TAG.cw);
    }
  });
  it('uma malha com 30 quadrados, UVs únicos no atlas 6x5, na frente de cada slot', () => {
    const anchors = Array.from({ length: 30 }, (_, i) => { const o = new THREE.Object3D(); o.position.set((i % 6) * 0.2, 2 - Math.floor(i / 6) * 0.34, 0.5); o.rotation.x = -0.12; o.updateMatrixWorld(true); return o; });
    const infos = anchors.map(() => ({ price: 100000000000000n, stock: 10, active: true }));
    const { mesh, update } = createPriceTags(anchors, infos);
    expect(mesh.geometry.attributes.position.count).toBe(120); expect(mesh.geometry.index.count).toBe(180);
    const uv = mesh.geometry.attributes.uv, firsts = new Set(); for (let i = 0; i < 30; i++) firsts.add(`${uv.getX(i * 4).toFixed(4)},${uv.getY(i * 4).toFixed(4)}`);
    expect(firsts.size).toBe(30);
    const p = mesh.geometry.attributes.position;                     // etiqueta 0 fica na borda da prateleira: abaixo do card (fora dele) e à frente
    const cy = (p.getY(0) + p.getY(2)) / 2; expect(anchors[0].position.y - cy).toBeGreaterThan(0.133); expect(p.getZ(0)).toBeGreaterThan(anchors[0].position.z + 0.1);
    expect(() => update(infos.map((x, i) => (i === 3 ? { ...x, stock: 0 } : x)))).not.toThrow();
  });
});
