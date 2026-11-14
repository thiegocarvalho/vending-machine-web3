import { describe, it, expect } from 'vitest';
import { buttonHit, BUTTON, SCREEN_W, SCREEN_H } from './machineScreen.js';

describe('buttonHit (uv da telinha 3D -> botão da carteira)', () => {
  const uvOf = (x, y) => ({ x: x / SCREEN_W, y: 1 - y / SCREEN_H });   // uv de textura tem origem embaixo
  it('hits inside the button rectangle', () => {
    expect(buttonHit(uvOf(BUTTON.x + BUTTON.w / 2, BUTTON.y + BUTTON.h / 2))).toBe(true);
    expect(buttonHit(uvOf(BUTTON.x + 1, BUTTON.y + 1))).toBe(true);
  });
  it('misses outside it (QR area, margins, top)', () => {
    expect(buttonHit(uvOf(BUTTON.x - 2, BUTTON.y + 5))).toBe(false);
    expect(buttonHit(uvOf(BUTTON.x + 5, BUTTON.y - 3))).toBe(false);
    expect(buttonHit(uvOf(SCREEN_W / 2, 60))).toBe(false);
    expect(buttonHit(null)).toBe(false);
  });
});
