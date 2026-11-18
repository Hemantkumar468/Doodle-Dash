import { describe, expect, it } from 'vitest';
import { ScoreCalculator } from '../src/game/ScoreCalculator.js';

describe('ScoreCalculator', () => {
  it('rewards fast guesses and slightly decays by guess order', () => {
    const fast = ScoreCalculator.guesser({ timeLeft: 80, drawTime: 80, guessOrder: 0 });
    const late = ScoreCalculator.guesser({ timeLeft: 10, drawTime: 80, guessOrder: 2 });
    expect(fast).toBe(600);
    expect(late).toBeLessThan(fast);
    expect(late).toBeGreaterThanOrEqual(100);
  });

  it('rewards a drawer in proportion to correct guessers', () => {
    expect(ScoreCalculator.drawer({ guessedCount: 0, eligibleCount: 3 })).toBe(0);
    expect(ScoreCalculator.drawer({ guessedCount: 2, eligibleCount: 3 })).toBe(200);
  });
});
