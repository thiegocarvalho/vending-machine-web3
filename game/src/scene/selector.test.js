import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { approach, bracketGeometry, createSelector, SEL } from './selector.js';

describe('seletor de card', () => {
  it('approach: suave, sem passar do alvo e independente do FPS', () => {
    let v = 0; for (let i = 0; i < 200; i++) v = approach(v, 1, 16, 1 / 60); expect(v).toBeGreaterThan(0.99); expect(v).toBeLessThanOrEqual(1);
    let a = 0, b = 0; for (let i = 0; i < 30; i++) a = approach(a, 1, 9, 1 / 30); for (let i = 0; i < 60; i++) b = approach(b, 1, 9, 1 / 60);
    expect(a).toBeCloseTo(b, 6);
  });
  it('cantoneiras: 4 cantos x 2 braços, todas fora do card e dentro da margem', () => {
    const g = bracketGeometry(), p = g.attributes.position;
    expect(p.count).toBe(8 * 4); expect(g.index.count).toBe(8 * 6);
    const hx = SEL.cardW / 2, hy = SEL.cardH / 2;
    for (let i = 0; i < p.count; i++) {                                // nenhum ponto invade o card; nenhum passa da margem + espessura
      const x = Math.abs(p.getX(i)), y = Math.abs(p.getY(i));
      expect(x > hx - 1e-9 || y > hy - 1e-9).toBe(true);
      expect(x).toBeLessThanOrEqual(hx + SEL.margin + 1e-9); expect(y).toBeLessThanOrEqual(hy + SEL.margin + 1e-9);
    }
  });
  it('o card selecionado salta para frente e cresce; ao desligar volta ao repouso', () => {
    const scene = new THREE.Scene(), sel = createSelector(scene);
    const anchor = new THREE.Object3D(); anchor.position.set(0, 1, 0.5); scene.add(anchor); anchor.updateMatrixWorld(true);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1)); anchor.add(card);
    sel.moveTo(anchor, card); sel.setOn(true);
    for (let i = 0; i < 120; i++) sel.update(1 / 60);
    expect(card.position.z).toBeCloseTo(SEL.popZ, 3); expect(card.scale.x).toBeCloseTo(1 + SEL.popScale, 3);
    sel.setOn(false); for (let i = 0; i < 200; i++) sel.update(1 / 60);
    expect(card.position.z).toBeCloseTo(0, 3); expect(card.scale.x).toBeCloseTo(1, 3); expect(sel.update(1 / 60)).toBe(false);
  });
  it('trocar de card: o anterior volta ao lugar e o novo salta', () => {
    const scene = new THREE.Scene(), sel = createSelector(scene), mk = (x) => { const a = new THREE.Object3D(); a.position.set(x, 1, 0.5); scene.add(a); a.updateMatrixWorld(true); const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1)); a.add(c); return [a, c]; };
    const [a1, c1] = mk(0), [a2, c2] = mk(0.3);
    sel.setOn(true); sel.moveTo(a1, c1); for (let i = 0; i < 100; i++) sel.update(1 / 60);
    sel.moveTo(a2, c2); for (let i = 0; i < 200; i++) sel.update(1 / 60);
    expect(c1.position.z).toBeCloseTo(0, 3); expect(c2.position.z).toBeCloseTo(SEL.popZ, 3);
  });
});
