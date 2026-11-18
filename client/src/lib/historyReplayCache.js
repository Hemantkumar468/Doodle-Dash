const replayStrokes = new Map();

const replayKey = (gameId, turnIndex) => `${gameId}:${turnIndex}`;

export function storeHistoryReplays(gameId, turns = []) {
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index] || {};
    const turnIndex = turn.turnIndex ?? index;
    replayStrokes.set(replayKey(gameId, turnIndex), Array.isArray(turn.strokes) ? turn.strokes : []);
  }
}

export function readHistoryReplay(gameId, turnIndex) {
  return replayStrokes.get(replayKey(gameId, turnIndex)) || [];
}

export function clearHistoryReplays(gameId) {
  if (!gameId) { replayStrokes.clear(); return; }
  const prefix = `${gameId}:`;
  for (const key of replayStrokes.keys()) if (key.startsWith(prefix)) replayStrokes.delete(key);
}
