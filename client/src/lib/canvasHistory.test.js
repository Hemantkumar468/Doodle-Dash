import { describe, expect, it } from 'vitest';
import gameReducer, { gameStateReceived } from '../features/game/gameSlice';
import { readCanvasHistory, replaceCanvasHistory, splitCanvasSnapshot } from './canvasHistory';

describe('canvas history isolation', () => {
  it('removes root stroke data before a snapshot reaches Redux', () => {
    const strokes = [{ id: 'one', points: [{ x: 0.25, y: 0.75 }] }];
    const { snapshot, strokeHistory } = splitCanvasSnapshot({ phase: 'DRAWING', strokeHistory: strokes });

    expect(snapshot).toEqual({ phase: 'DRAWING' });
    expect(strokeHistory).toEqual(strokes);
    expect(strokeHistory).not.toBe(strokes);
  });

  it('removes nested stroke data without mutating the server payload', () => {
    const payload = { roomId: 'ABC234', game: { phase: 'DRAWING', strokeHistory: [{ id: 'two', points: [] }] } };
    const { snapshot, strokeHistory } = splitCanvasSnapshot(payload);

    expect(snapshot.game).toEqual({ phase: 'DRAWING' });
    expect(strokeHistory).toHaveLength(1);
    expect(payload.game.strokeHistory).toHaveLength(1);
  });

  it('keeps cached points outside Redux and returns defensive copies', () => {
    replaceCanvasHistory([{ id: 'three', points: [{ x: 0, y: 1 }] }]);
    const first = readCanvasHistory();
    first[0].points[0].x = 1;

    expect(readCanvasHistory()[0].points[0].x).toBe(0);
  });

  it('preserves the Redux shape while refusing stroke points', () => {
    const state = gameReducer(undefined, gameStateReceived({ phase: 'DRAWING', strokeHistory: [{ id: 'four', points: [{ x: 0, y: 0 }] }] }));

    expect(state.phase).toBe('DRAWING');
    expect(state).toHaveProperty('strokeHistory');
    expect(state.strokeHistory).toEqual([]);
  });
});
