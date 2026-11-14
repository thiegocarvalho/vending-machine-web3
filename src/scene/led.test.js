import { describe, it, expect } from 'vitest';
import { GLYPHS, textToDots, drawLed, LED_CELLS } from './led.js';

describe('LED dot-matrix', () => {
  it('every glyph is 5x7', () => {
    for (const [ch, g] of Object.entries(GLYPHS)) {
      expect(g, ch).toHaveLength(7);
      g.forEach((row) => expect(row, ch).toHaveLength(5));
    }
  });
  it('cabe o status da máquina: DISPONIVEL e INDISPONIVEL', () => {
    for (const w of ['DISPONIVEL', 'INDISPONIVEL']) { expect(w.length).toBeLessThanOrEqual(LED_CELLS); for (const ch of w) expect(GLYPHS[ch], ch).toBeTruthy(); }
  });
  it('supports slots (A-E, 1-6), card numbers, SOLD, OK and ERR', () => {
    for (const ch of 'ABCDE0123456789#- SOLKR') expect(GLYPHS[ch], ch).toBeTruthy();
  });
  it('lays text into a 12-cell, 72x7 dot grid, centered and padded', () => {
    const dots = textToDots('A1');
    expect(dots).toHaveLength(7);
    dots.forEach((r) => expect(r).toHaveLength(LED_CELLS * 6));
    const lit = dots.flat().filter(Boolean).length;
    const expected = [...GLYPHS['A'], ...GLYPHS['1']].join('').split('').filter((c) => c === '#').length;
    expect(lit).toBe(expected);
  });
  it('truncates long text to the cell count and treats unknown chars as blank', () => {
    expect(textToDots('A1 #01 EXTRA')[0]).toHaveLength(LED_CELLS * 6);
    expect(textToDots('~').flat().some(Boolean)).toBe(false);
  });
  it('draws one dim dot per grid cell plus lit ones', () => {
    let arcs = 0; const ctx = new Proxy({}, { get: (t, k) => (k === 'arc' ? () => { arcs++; } : () => {}), set: () => true });
    drawLed(ctx, 'A1', 480, 102);
    expect(arcs).toBe(LED_CELLS * 6 * 7 + textToDots('A1').flat().filter(Boolean).length);
  });
});
