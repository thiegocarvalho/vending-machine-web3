import { describe, it, expect, vi } from 'vitest';
import { FONT, decompose } from '../scene/dotfont.js';
import { textWidth, fitDot, clip, wrapText, drawLcdText, paintLcdBackground, CELL_W } from './lcd.js';

const recorder = () => { const calls = []; const g = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'createPattern' ? () => ({}) : (...a) => { calls.push([k, ...a]); }), set: () => true }); return { g, calls }; };

describe('fonte de matriz de pontos', () => {
  it('todo glifo é 5x7', () => {
    for (const [ch, rows] of Object.entries(FONT)) { expect(rows, ch).toHaveLength(7); rows.forEach((r) => expect(r, ch).toHaveLength(5)); }
  });
  it('cobre todo texto da telinha: A-Z, 0-9 e pontuação usada', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:!?-+/()%#·×…→←') expect(FONT[ch], ch).toBeTruthy();
  });
  it('acentos viram letra base + marca; letra minúscula usa a maiúscula; desconhecido vira espaço', () => {
    expect(decompose('Ç')).toMatchObject({ base: 'C' }); expect(decompose('Ç').marks[0].below).toBeTruthy();
    expect(decompose('Ã').marks[0].above).toBeTruthy(); expect(decompose('É').base).toBe('E');
    expect(decompose('a').base).toBe('A'); expect(decompose('€').base).toBe(' ');
  });
});

describe('visor LCD', () => {
  it('mede, ajusta e corta o texto para caber', () => {
    expect(textWidth('AB', 3)).toBe(2 * CELL_W * 3 - 3);
    expect(fitDot('TEXTO MUITO COMPRIDO AQUI', 120, 4, 2)).toBe(2);
    expect(fitDot('OK', 120, 4, 2)).toBe(4);
    const c = clip('NOME ENORME DE UM CARD COLECIONAVEL', 100, 2); expect(c.endsWith('…')).toBe(true); expect(textWidth(c, 2)).toBeLessThanOrEqual(100);
    expect(clip('CURTO', 200, 2)).toBe('CURTO');
  });
  it('quebra em linhas por quantidade de caracteres', () => {
    expect(wrapText('TRANSACAO REJEITADA NA CARTEIRA', 14)).toEqual(['TRANSACAO', 'REJEITADA NA', 'CARTEIRA']);
  });
  it('desenha exatamente os pontos acesos do glifo (mais a sombra)', () => {
    const { g, calls } = recorder(); drawLcdText(g, 'A', 10, 10, { dot: 4 });
    const lit = FONT.A.join('').split('').filter((c) => c === '#').length;
    expect(calls.filter((c) => c[0] === 'fillRect')).toHaveLength(lit * 2);              // sombra + tinta
    const { g: g2, calls: c2 } = recorder(); drawLcdText(g2, 'A', 10, 10, { dot: 4, shadow: false });
    expect(c2.filter((c) => c[0] === 'fillRect')).toHaveLength(lit);
  });
  it('alinha ao centro e à direita pela largura real', () => {
    const { g, calls } = recorder(); drawLcdText(g, 'I', 100, 0, { dot: 2, align: 'center', shadow: false });
    const xs = calls.filter((c) => c[0] === 'fillRect').map((c) => c[1]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(100 - textWidth('I', 2) / 2 - 0.01);
  });
  it('o fundo pinta com a grade de pontos apagados', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => recorder().g }) });
    expect(() => paintLcdBackground(recorder().g, 256, 384)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
