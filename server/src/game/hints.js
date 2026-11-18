export function makeBlank(word, revealed = new Set(), hidden = false) {
  if (hidden) return '';
  return [...String(word || '')].map((character, index) => {
    if (/\s|[-']/u.test(character)) return character;
    return revealed.has(index) ? character : '_';
  }).join(' ');
}

export function revealableIndexes(word) {
  return [...String(word || '')].map((character, index) => /[\p{L}\p{N}]/u.test(character) ? index : -1).filter((i) => i >= 0);
}

export function chooseHintIndexes(word, count, random = Math.random) {
  const available = revealableIndexes(word);
  const maximum = Math.max(0, available.length - 1);
  const wanted = Math.min(maximum, Math.max(0, count));
  const result = [];
  while (result.length < wanted && available.length) {
    const index = Math.floor(random() * available.length);
    result.push(available.splice(index, 1)[0]);
  }
  return result;
}
