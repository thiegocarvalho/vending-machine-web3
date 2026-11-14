import { describe, it, expect } from 'vitest';
import { cardIdToSlot, slotToCardId, moveSelection } from './grid.js';

describe('grid 5x6', () => {
  it('maps ids to labels', () => {
    expect(cardIdToSlot(1).label).toBe('A1');
    expect(cardIdToSlot(6).label).toBe('A6');
    expect(cardIdToSlot(7).label).toBe('B1');
    expect(cardIdToSlot(30).label).toBe('E6');
    expect(cardIdToSlot(30)).toMatchObject({ row: 4, col: 5 });
  });
  it('rejects out of range', () => {
    expect(() => cardIdToSlot(0)).toThrow(RangeError);
    expect(() => cardIdToSlot(31)).toThrow(RangeError);
  });
  it('moves and clamps', () => {
    expect(moveSelection(1, 'left')).toBe(1);
    expect(moveSelection(6, 'right')).toBe(6);
    expect(moveSelection(1, 'down')).toBe(7);
    expect(moveSelection(30, 'down')).toBe(30);
    expect(moveSelection(7, 'up')).toBe(1);
  });
  it('slotToCardId', () => { expect(slotToCardId(4, 5)).toBe(30); });
});
