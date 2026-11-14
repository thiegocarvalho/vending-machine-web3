// Painel de caracteres em LED vermelho (matriz de pontos 5x7).
export const LED_CELLS = 6;
const G = (s) => s.trim().split('\n').map((r) => r.trim());
export const GLYPHS = {
  ' ': G('.....\n.....\n.....\n.....\n.....\n.....\n.....'),
  '-': G('.....\n.....\n.....\n#####\n.....\n.....\n.....'),
  '#': G('.#.#.\n.#.#.\n#####\n.#.#.\n#####\n.#.#.\n.#.#.'),
  '0': G('.###.\n#...#\n#..##\n#.#.#\n##..#\n#...#\n.###.'),
  '1': G('..#..\n.##..\n..#..\n..#..\n..#..\n..#..\n.###.'),
  '2': G('.###.\n#...#\n....#\n...#.\n..#..\n.#...\n#####'),
  '3': G('#####\n...#.\n..#..\n...#.\n....#\n#...#\n.###.'),
  '4': G('...#.\n..##.\n.#.#.\n#..#.\n#####\n...#.\n...#.'),
  '5': G('#####\n#....\n####.\n....#\n....#\n#...#\n.###.'),
  '6': G('..##.\n.#...\n#....\n####.\n#...#\n#...#\n.###.'),
  '7': G('#####\n....#\n...#.\n..#..\n.#...\n.#...\n.#...'),
  '8': G('.###.\n#...#\n#...#\n.###.\n#...#\n#...#\n.###.'),
  '9': G('.###.\n#...#\n#...#\n.####\n....#\n...#.\n.##..'),
  A: G('.###.\n#...#\n#...#\n#####\n#...#\n#...#\n#...#'),
  B: G('####.\n#...#\n#...#\n####.\n#...#\n#...#\n####.'),
  C: G('.###.\n#...#\n#....\n#....\n#....\n#...#\n.###.'),
  D: G('####.\n#...#\n#...#\n#...#\n#...#\n#...#\n####.'),
  E: G('#####\n#....\n#....\n####.\n#....\n#....\n#####'),
  S: G('.####\n#....\n#....\n.###.\n....#\n....#\n####.'),
  O: G('.###.\n#...#\n#...#\n#...#\n#...#\n#...#\n.###.'),
  L: G('#....\n#....\n#....\n#....\n#....\n#....\n#####'),
  K: G('#...#\n#..#.\n#.#..\n##...\n#.#..\n#..#.\n#...#'),
  R: G('####.\n#...#\n#...#\n####.\n#.#..\n#..#.\n#...#')
};

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
