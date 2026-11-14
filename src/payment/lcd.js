import { FONT, decompose } from '../scene/dotfont.js';

// Visor LCD de equipamento antigo: matriz de pontos 5x7 em tinta escura sobre um fundo verde-amarelado com luz traseira,
// pontos apagados visíveis ("fantasma") e leve sombra de paralaxe do vidro.
export const LCD = { paper: '#a9bd7f', paperHi: '#c0d396', paperLo: '#8aa064', ink: '#17230c', ghost: 'rgba(23,35,12,0.07)' };
export const CELL_W = 6, CELL_H = 7;                      // 5 colunas + 1 de espaço; 7 linhas

export const textWidth = (text, dot) => (text.length ? [...text].length * CELL_W * dot - dot : 0);
export const textHeight = (dot) => CELL_H * dot;

// maior tamanho de ponto (até `want`) em que o texto cabe em maxW; nunca menor que minDot
export function fitDot(text, maxW, want = 3, minDot = 2) {
  let d = want; while (d > minDot && textWidth(text, d) > maxW) d--;
  return d;
}
// corta com reticências se mesmo no menor ponto não couber
export function clip(text, maxW, dot) {
  let t = [...text];
  if (textWidth(t.join(''), dot) <= maxW) return t.join('');
  while (t.length > 1 && textWidth(t.join('') + '…', dot) > maxW) t.pop();
  return t.join('') + '…';
}
export function wrapText(text, maxChars) {
  const lines = []; let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if ([...(line + ' ' + w)].length > maxChars && line) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line); return lines;
}

// y = topo do texto (linha de cima dos pontos); align: left | center | right. Retorna a largura desenhada.
export function drawLcdText(g, text, x, y, { dot = 3, align = 'left', color = LCD.ink, shadow = true } = {}) {
  const str = String(text).toUpperCase(), w = textWidth(str, dot);
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, sz = dot >= 3 ? dot - 1 : dot - 0.4;
  const pass = (fill, ox, oy) => {
    g.fillStyle = fill;
    [...str].forEach((ch, i) => {
      const { base, marks } = decompose(ch), cx = x0 + i * CELL_W * dot + ox;
      const put = (rows, ry) => rows.forEach((row, r) => { for (let c = 0; c < 5; c++) if (row[c] === '#') g.fillRect(cx + c * dot, y + (ry + r) * dot + oy, sz, sz); });
      put(FONT[base], 0);
      for (const m of marks) { if (m.above) put(m.above, -2); if (m.below) put(m.below, CELL_H); }
    });
  };
  if (shadow) pass('rgba(23,35,12,0.16)', 1.2, 1.2);       // sombra de paralaxe do vidro
  pass(color, 0, 0);
  return w;
}

// fundo do visor: luz traseira (mais clara no centro), vinheta, grade de pontos apagados e moldura
export function paintLcdBackground(g, w, h) {
  const bg = g.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, LCD.paperHi); bg.addColorStop(0.55, LCD.paper); bg.addColorStop(1, LCD.paperLo);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const tile = document.createElement('canvas'); tile.width = tile.height = 3;
  const t = tile.getContext('2d'); t.fillStyle = LCD.ghost; t.fillRect(0, 0, 2, 2);
  const pat = g.createPattern(tile, 'repeat'); if (pat) { g.fillStyle = pat; g.fillRect(0, 0, w, h); }
  g.strokeStyle = 'rgba(23,35,12,0.55)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
  g.strokeStyle = 'rgba(255,255,230,0.25)'; g.lineWidth = 1; g.strokeRect(5.5, 5.5, w - 11, h - 11);
}
