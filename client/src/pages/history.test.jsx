import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '../lib/messages';
import History from './History';
import HistoryDetails from './HistoryDetails';
import {
  useClearHistoryMutation,
  useDeleteHistoryGameMutation,
  useGetHistoryGameQuery,
  useGetHistoryQuery,
  useLazyGetHistoryQuery,
} from '../features/history/historyApi';

vi.mock('../features/history/historyApi', () => ({
  useGetHistoryQuery: vi.fn(),
  useLazyGetHistoryQuery: vi.fn(),
  useGetHistoryGameQuery: vi.fn(),
  useDeleteHistoryGameMutation: vi.fn(),
  useClearHistoryMutation: vi.fn(),
}));

vi.mock('../components/ReplayCanvas', () => ({ default: () => <div role="region" aria-label={messages.history.replay.region} /> }));

const summary = {
  id: 'game-1', roomId: 'ABC123', endedAt: '2026-11-19T10:00:00.000Z', durationSec: 125,
  playerCount: 3, myRank: 2, myScore: 240, winnerName: 'Neha',
};

beforeEach(() => {
  useGetHistoryQuery.mockReturnValue({ data: { games: [summary] }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() });
  useLazyGetHistoryQuery.mockReturnValue([vi.fn(), { isFetching: false }]);
  useClearHistoryMutation.mockReturnValue([vi.fn(), { isLoading: false }]);
  useDeleteHistoryGameMutation.mockReturnValue([vi.fn(), { isLoading: false }]);
  useGetHistoryGameQuery.mockReturnValue({
    data: {
      ...summary,
      settings: { rounds: 3, drawTime: 80, wordMode: 'Normal', wordCount: 3, hints: 2 },
      players: [
        { rank: 1, name: 'Neha', avatar: '🦊', finalScore: 300 },
        { rank: 2, name: 'Ravi', avatar: '🐼', finalScore: 240 },
      ],
      turns: [
        { round: 1, turnIndex: 0, drawerName: 'Neha', word: 'apple', guessers: [{ name: 'Ravi', points: 90, guessedAtSec: 14 }], drawerPoints: 60 },
        { round: 1, turnIndex: 1, drawerName: 'Ravi', word: 'kite', guessers: [], drawerPoints: 0 },
      ],
    },
    isLoading: false, isError: false, refetch: vi.fn(),
  });
});

describe('game history pages', () => {
  it('renders a history summary card', () => {
    render(<MemoryRouter><History /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: messages.history.title })).toBeInTheDocument();
    expect(screen.getByText(messages.history.youPlaced(2, 240))).toBeInTheDocument();
    expect(screen.getByText(messages.history.winner('Neha'))).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    useGetHistoryQuery.mockReturnValue({ data: { games: [] }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() });
    render(<MemoryRouter><History /></MemoryRouter>);
    expect(screen.getByText(messages.history.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.history.emptyHint)).toBeInTheDocument();
  });

  it('renders friendly history errors', () => {
    useGetHistoryQuery.mockReturnValue({ isLoading: false, isFetching: false, isError: true, refetch: vi.fn() });
    render(<MemoryRouter><History /></MemoryRouter>);
    expect(screen.getByText(messages.history.loadError)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.tryAgain })).toBeInTheDocument();
  });

  it('renders game details, leaderboard and turns', () => {
    render(<MemoryRouter initialEntries={['/history/game-1']}><Routes><Route path="/history/:gameId" element={<HistoryDetails />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: messages.history.roomCode('ABC123') })).toBeInTheDocument();
    expect(screen.getByText(messages.history.leaderboard)).toBeInTheDocument();
    expect(screen.getByText(messages.history.word('apple'), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: messages.history.replay.region })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: messages.history.replay.region })).toHaveLength(1);
  });
});
