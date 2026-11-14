import { ROWS, COLS, cardIdToSlot } from '../grid.js';

export function renderMinimap(selectedId) {
  const { row, col } = cardIdToSlot(selectedId);
  return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => r === row && c === col));
}
