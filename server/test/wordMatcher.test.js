import { describe, expect, it } from 'vitest';
import { levenshtein, matchGuess, normalizeGuess } from '../src/game/wordMatcher.js';

describe('word matching', () => {
  it('normalizes case, surrounding whitespace, and repeated spaces', () => {
    expect(normalizeGuess('  Polar   BEAR ')).toBe('polar bear');
    expect(matchGuess('  Polar   BEAR ', 'polar bear').exact).toBe(true);
  });

  it('marks a one-edit guess as close only for words longer than four letters', () => {
    expect(matchGuess('girafe', 'giraffe')).toEqual({ exact: false, close: true });
    expect(matchGuess('cot', 'cat')).toEqual({ exact: false, close: false });
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});
