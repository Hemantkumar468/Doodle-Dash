export const DEFAULT_SETTINGS = Object.freeze({
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordChoices: 3,
  hints: 2,
  wordMode: 'Normal',
  isPrivate: false,
  customWords: ''
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export function normalizeSettings(value = {}, previous = DEFAULT_SETTINGS) {
  const source = { ...previous, ...value };
  const mode = ['Normal', 'Hidden', 'Combination'].includes(source.wordMode) ? source.wordMode : previous.wordMode;
  return {
    maxPlayers: clamp(source.maxPlayers, 2, 20, previous.maxPlayers),
    rounds: clamp(source.rounds, 2, 10, previous.rounds),
    drawTime: clamp(source.drawTime, 15, 240, previous.drawTime),
    wordChoices: clamp(source.wordChoices, 1, 5, previous.wordChoices),
    hints: clamp(source.hints, 0, 5, previous.hints),
    wordMode: mode,
    isPrivate: Boolean(source.isPrivate),
    customWords: String(source.customWords ?? '').slice(0, 2000)
  };
}
