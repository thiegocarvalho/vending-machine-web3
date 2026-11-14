// Painel de caracteres em LED vermelho (matriz de pontos 5x7).
export const LED_CELLS = 12;       // cabe "INDISPONIVEL"
import { FONT } from './dotfont.js';
export const GLYPHS = FONT;

// Texto -> grade de pontos acesos (7 linhas x LED_CELLS*6 colunas), centralizado.
export function textToDots(text) {
  const chars = [...String(text).toUpperCase()].slice(0, LED_CELLS);
  const pad = Math.floor((LED_CELLS - chars.length) / 2);
  const cols = LED_CELLS * 6, rows = Array.from({ length: 7 }, () => new Array(cols).fill(false));
  chars.forEach((ch, i) => {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) rows[r][(i + pad) * 6 + c] = g[r][c] === '#';
  });
  return rows;
}

export function drawLed(ctx, text, w, h) {
  ctx.fillStyle = '#080204'; ctx.fillRect(0, 0, w, h);
  const dots = textToDots(text), cols = dots[0].length, pitch = Math.min(w / (cols + 1), h / 8);
  const ox = (w - cols * pitch) / 2 + pitch / 2, oy = (h - 7 * pitch) / 2 + pitch / 2;
  ctx.fillStyle = '#2b0508';                                   // LEDs apagados
  for (let r = 0; r < 7; r++) for (let c = 0; c < cols; c++) { ctx.beginPath(); ctx.arc(ox + c * pitch, oy + r * pitch, pitch * 0.32, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowColor = '#ff1a2e'; ctx.shadowBlur = pitch * 0.9; ctx.fillStyle = '#ff3345';   // LEDs acesos com brilho
  for (let r = 0; r < 7; r++) for (let c = 0; c < cols; c++) if (dots[r][c]) { ctx.beginPath(); ctx.arc(ox + c * pitch, oy + r * pitch, pitch * 0.36, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;
}
