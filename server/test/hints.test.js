import { describe, expect, it } from 'vitest';
import { chooseHintIndexes, makeBlank } from '../src/game/hints.js';

describe('hints', () => {
  it('never reveals every letter and preserves spaces', () => {
    const indexes = chooseHintIndexes('ice cream', 20, () => 0);
    expect(indexes).toHaveLength(7);
    const blank = makeBlank('ice cream', new Set(indexes));
    expect(blank).toContain(' ');
    expect(blank).toContain('_');
  });

  it('supports hidden mode', () => expect(makeBlank('house', new Set(), true)).toBe(''));
});
