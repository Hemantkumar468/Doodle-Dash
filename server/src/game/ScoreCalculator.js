export class ScoreCalculator {
  static guesser({ timeLeft, drawTime, guessOrder = 0 }) {
    const duration = Math.max(1, Number(drawTime) || 1);
    const remaining = Math.max(0, Math.min(duration, Number(timeLeft) || 0));
    const orderPenalty = Math.max(0, Number(guessOrder) || 0) * 10;
    return Math.max(100, 100 + Math.floor(500 * remaining / duration) - orderPenalty);
  }

  static drawer({ guessedCount, eligibleCount }) {
    if (!eligibleCount || !guessedCount) return 0;
    return Math.floor(300 * Math.min(guessedCount, eligibleCount) / eligibleCount);
  }
}
