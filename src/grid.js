export const ROWS = 5;
export const COLS = 6;
export const TOTAL = ROWS * COLS;

export function cardIdToSlot(id) {
  if (!Number.isInteger(id) || id < 1 || id > TOTAL) throw new RangeError(`card id out of range: ${id}`);
  const row = Math.floor((id - 1) / COLS);
  const col = (id - 1) % COLS;
  return { id, row, col, label: `${String.fromCharCode(65 + row)}${col + 1}` };
}

export function slotToCardId(row, col) { return row * COLS + col + 1; }

export function moveSelection(id, dir) {
  const { row, col } = cardIdToSlot(id);
  const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
  const r = Math.min(ROWS - 1, Math.max(0, row + d[0]));
  const c = Math.min(COLS - 1, Math.max(0, col + d[1]));
  return slotToCardId(r, c);
}
