import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoundEndOverlay from './RoundEndOverlay';
import Leaderboard from './Leaderboard';
import GameOver from '../pages/GameOver';
import { store } from '../app/store';
import { hydrateRoom } from '../features/room/roomSlice';
import { gameEnded } from '../features/game/gameSlice';
import { sessionSet } from '../features/session/sessionSlice';
import { messages } from '../lib/messages';
import { readSession, saveSession } from '../lib/session';
import { socket } from '../lib/socket';

describe('agreed result payloads', () => {
  it('renders a round_end payload without attempting to render objects', () => {
    render(<RoundEndOverlay result={{ word: 'tree house', scores: [{ playerId: 'p1', name: 'Ari', avatar: '🦊', delta: 430, total: 930 }], nextDrawer: 'p2' }} />);
    expect(screen.getByText(messages.roundEnd.wordWas('tree house'))).toBeInTheDocument();
    expect(screen.getByText('Ari')).toBeInTheDocument();
    expect(screen.getByText(messages.roundEnd.gained(430))).toBeInTheDocument();
  });

  it('renders a game_over leaderboard payload', () => {
    const winner = { playerId: 'p1', name: 'Ari', score: 1200 };
    render(<Leaderboard winner={winner} leaderboard={[{ rank: 1, playerId: 'p1', name: 'Ari', avatar: '🦊', score: 1200 }, { rank: 2, playerId: 'p2', name: 'Bo', avatar: '🐼', score: 800 }]} />);
    expect(screen.getByText('Ari')).toBeInTheDocument();
    expect(screen.getByText(messages.players.points(1200))).toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });

  it('renders the game-over page from the agreed payload', () => {
    const payload = {
      winner: { playerId: 'p1', name: 'Ari', score: 1200 },
      leaderboard: [{ rank: 1, playerId: 'p1', name: 'Ari', avatar: '🦊', score: 1200 }],
    };
    store.dispatch(sessionSet({ playerId: 'p1', roomId: 'ABC234', name: 'Ari', avatar: '🦊' }));
    store.dispatch(hydrateRoom({ room: { roomId: 'ABC234' }, players: [{ id: 'p1', name: 'Ari', avatar: '🦊', score: 1200, isHost: true, isConnected: true, hasGuessed: false }] }));
    store.dispatch(gameEnded(payload));
    render(<Provider store={store}><MemoryRouter><GameOver /></MemoryRouter></Provider>);
    expect(screen.getByRole('heading', { name: /Ari wins/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
  });

  it('leaves the room before opening the saved game', () => {
    const historyId = '507f1f77bcf86cd799439011';
    const payload = {
      historyId,
      winner: { playerId: 'p1', name: 'Ari', score: 1200 },
      leaderboard: [{ rank: 1, playerId: 'p1', name: 'Ari', avatar: '🦊', score: 1200 }],
    };
    store.dispatch(sessionSet({ playerId: 'p1', roomId: 'ABC234', name: 'Ari', avatar: '🦊' }));
    store.dispatch(hydrateRoom({ room: { roomId: 'ABC234' }, players: [{ id: 'p1', name: 'Ari', avatar: '🦊', score: 1200, isHost: true, isConnected: true, hasGuessed: false }] }));
    store.dispatch(gameEnded(payload));
    saveSession({ playerId: 'p1', roomId: 'ABC234', name: 'Ari', avatar: '🦊' });
    const emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket);

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<GameOver />} />
            <Route path="/history/:gameId" element={<p>Saved game opened</p>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: messages.history.viewGame }));

    expect(screen.getByText('Saved game opened')).toBeInTheDocument();
    expect(emit).toHaveBeenCalledWith('leave_room', { roomId: 'ABC234' }, undefined);
    expect(readSession()).toBeNull();
    emit.mockRestore();
  });
});
