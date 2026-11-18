export function normalizeGuess(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
}

export function levenshtein(a, b) {
  const left = [...normalizeGuess(a)];
  const right = [...normalizeGuess(b)];
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let col = 1; col <= right.length; col += 1) {
      current[col] = Math.min(
        current[col - 1] + 1,
        previous[col] + 1,
        previous[col - 1] + (left[row - 1] === right[col - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function matchGuess(guess, answer) {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedAnswer = normalizeGuess(answer);
  const exact = Boolean(normalizedAnswer) && normalizedGuess === normalizedAnswer;
  return {
    exact,
    close: !exact && normalizedAnswer.length > 4 && levenshtein(normalizedGuess, normalizedAnswer) === 1
  };
}
