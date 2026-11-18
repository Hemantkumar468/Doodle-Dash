let history = [];
const subscribers = new Set();

function cloneHistory(value) {
  return Array.isArray(value) ? structuredClone(value) : [];
}

export function readCanvasHistory() {
  return cloneHistory(history);
}

export function cacheCanvasHistory(value) {
  history = Array.isArray(value) ? value : [];
}

export function replaceCanvasHistory(value) {
  history = cloneHistory(value);
  for (const subscriber of subscribers) subscriber(readCanvasHistory());
}

export function subscribeCanvasHistory(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function splitCanvasSnapshot(payload = {}) {
  if (!payload || typeof payload !== 'object') return { snapshot: payload, strokeHistory: null };

  let strokeHistory = null;
  let snapshot = payload;

  if (Object.prototype.hasOwnProperty.call(payload, 'strokeHistory')) {
    ({ strokeHistory } = payload);
    snapshot = { ...payload };
    delete snapshot.strokeHistory;
  }

  if (payload.game && typeof payload.game === 'object' && Object.prototype.hasOwnProperty.call(payload.game, 'strokeHistory')) {
    if (strokeHistory === null) strokeHistory = payload.game.strokeHistory;
    snapshot = snapshot === payload ? { ...payload } : snapshot;
    snapshot.game = { ...payload.game };
    delete snapshot.game.strokeHistory;
  }

  return { snapshot, strokeHistory: strokeHistory === null ? null : cloneHistory(strokeHistory) };
}
