import { describe, it, expect } from 'vitest';
import { fitDistance, zoomRange, zoomBy, stepInertia, paintCardBack, CARD } from './cardViewer.js';

describe('visualizador: matemática', () => {
  it('o card inteiro cabe na tela em qualquer proporção (retrato, quadrado, paisagem)', () => {
    const TAN = Math.tan((40 * Math.PI) / 360);
    for (const a of [0.46, 0.75, 1, 1.6, 2.2]) {
      const d = fitDistance(a);
      expect(CARD.h / 2 / (TAN * d)).toBeLessThanOrEqual(0.95);                // altura cabe
      expect(CARD.w / 2 / (TAN * d * a)).toBeLessThanOrEqual(0.95);            // largura cabe
    }
    expect(fitDistance(0.46)).toBeGreaterThan(fitDistance(1.6));               // tela estreita: mais longe
  });
  it('o zoom fica dentro dos limites', () => {
    const fit = fitDistance(1), r = zoomRange(fit);
    expect(zoomBy(fit, 0.0001, fit)).toBe(r.min); expect(zoomBy(fit, 1000, fit)).toBe(r.max);
    expect(zoomBy(fit, 0.9, fit)).toBeLessThan(fit);
  });
  it('a inércia desacelera até parar e limita a inclinação', () => {
    const s = { yaw: 0, pitch: 0, vyaw: 6, vpitch: 20 };
    let steps = 0; while (stepInertia(s, 1 / 60) && steps < 2000) steps++;
    expect(steps).toBeGreaterThan(5); expect(steps).toBeLessThan(2000);
    expect(s.yaw).toBeGreaterThan(0); expect(Math.abs(s.pitch)).toBeLessThanOrEqual(0.9);
  });
  it('o verso do card pinta sem erro', () => {
    const g = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
    expect(() => paintCardBack(g, 384, 512, () => 0.5)).not.toThrow();
  });
});
