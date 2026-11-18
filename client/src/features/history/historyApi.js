import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { SERVER_URL } from '../../lib/config';
import { getDeviceId } from '../../lib/device';
import { clearHistoryReplays, storeHistoryReplays } from '../../lib/historyReplayCache';

function withoutReplayPayload(response, gameId) {
  const game = response?.game || response;
  if (!game || typeof game !== 'object') return response;
  const id = String(game.id || game._id || gameId || '');
  const turns = Array.isArray(game.turns) ? game.turns : [];
  storeHistoryReplays(id, turns);
  const safeGame = { ...game, turns: turns.map(({ strokes, ...turn }) => ({ ...turn, replayAvailable: Array.isArray(strokes) && strokes.length > 0 })) };
  return response?.game ? { ...response, game: safeGame } : safeGame;
}

export const historyApi = createApi({
  reducerPath: 'historyApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${SERVER_URL}/api/history`,
    prepareHeaders: (headers) => {
      headers.set('X-Device-Id', getDeviceId());
      return headers;
    },
  }),
  tagTypes: ['History', 'HistoryGame'],
  endpoints: (builder) => ({
    getHistory: builder.query({
      query: ({ limit = 20, cursor } = {}) => ({ url: '', params: { limit, ...(cursor ? { cursor } : {}) } }),
      providesTags: (result) => [
        { type: 'History', id: 'LIST' },
        ...((result?.games || result?.items || []).map((game) => ({ type: 'HistoryGame', id: game.id || game._id }))),
      ],
    }),
    getHistoryGame: builder.query({
      query: (gameId) => `/${encodeURIComponent(gameId)}`,
      transformResponse: (response, _meta, gameId) => withoutReplayPayload(response, gameId),
      keepUnusedDataFor: 0,
      async onCacheEntryAdded(gameId, { cacheDataLoaded, cacheEntryRemoved }) {
        try {
          await cacheDataLoaded;
          await cacheEntryRemoved;
          clearHistoryReplays(gameId);
        } catch { /* The request ended before a replay was cached. */ }
      },
      providesTags: (_result, _error, gameId) => [{ type: 'HistoryGame', id: gameId }],
    }),
    deleteHistoryGame: builder.mutation({
      query: (gameId) => ({ url: `/${encodeURIComponent(gameId)}`, method: 'DELETE' }),
      async onQueryStarted(gameId, { queryFulfilled }) {
        try {
          await queryFulfilled;
          clearHistoryReplays(gameId);
        } catch { /* Keep cached data available when deletion fails. */ }
      },
      invalidatesTags: (_result, error) => error ? [] : [{ type: 'History', id: 'LIST' }],
    }),
    clearHistory: builder.mutation({
      query: () => ({ url: '', method: 'DELETE' }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try { await queryFulfilled; clearHistoryReplays(); } catch { /* Keep local replay data when deletion fails. */ }
      },
      invalidatesTags: [{ type: 'History', id: 'LIST' }, { type: 'HistoryGame' }],
    }),
  }),
});

export const {
  useGetHistoryQuery,
  useLazyGetHistoryQuery,
  useGetHistoryGameQuery,
  useDeleteHistoryGameMutation,
  useClearHistoryMutation,
} = historyApi;
