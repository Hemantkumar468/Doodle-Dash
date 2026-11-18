import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { historyApi } from './historyApi';

function makeStore() {
  return configureStore({
    reducer: { [historyApi.reducerPath]: historyApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(historyApi.middleware),
  });
}

describe('history deletion cache handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears cached details after a successful delete without issuing a detail refetch', async () => {
    const fetchMock = vi.fn().mockImplementation(async (request) => {
      const body = request.method === 'DELETE'
        ? { removed: true }
        : { game: { id: '507f1f77bcf86cd799439011', roomId: 'ABC123', turns: [] } };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const store = makeStore();
    const gameId = '507f1f77bcf86cd799439011';
    const detailSubscription = store.dispatch(historyApi.endpoints.getHistoryGame.initiate(gameId));
    await detailSubscription.unwrap();

    const result = await store.dispatch(historyApi.endpoints.deleteHistoryGame.initiate(gameId));
    await Promise.resolve();

    expect(result.error).toBeUndefined();
    expect(historyApi.endpoints.getHistoryGame.select(gameId)(store.getState()).status).toBe('fulfilled');
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'DELETE')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'GET')).toHaveLength(1);

    detailSubscription.unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(historyApi.endpoints.getHistoryGame.select(gameId)(store.getState()).status).toBe('uninitialized');
  });

  it('keeps cached details when deletion fails', async () => {
    const fetchMock = vi.fn().mockImplementation(async (request) => new Response(JSON.stringify(
      request.method === 'DELETE'
        ? { error: 'failed' }
        : { game: { id: '507f1f77bcf86cd799439011', roomId: 'ABC123', turns: [] } },
    ), {
      status: request.method === 'DELETE' ? 500 : 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const store = makeStore();
    const gameId = '507f1f77bcf86cd799439011';
    const detailSubscription = store.dispatch(historyApi.endpoints.getHistoryGame.initiate(gameId));
    await detailSubscription.unwrap();

    const result = await store.dispatch(historyApi.endpoints.deleteHistoryGame.initiate(gameId));

    expect(result.error?.status).toBe(500);
    expect(historyApi.endpoints.getHistoryGame.select(gameId)(store.getState()).data?.game?.roomId).toBe('ABC123');
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'DELETE')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'GET')).toHaveLength(1);
    detailSubscription.unsubscribe();
  });
});
