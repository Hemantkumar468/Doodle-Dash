import { io } from 'socket.io-client';
import { SERVER_URL } from './config';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 600,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.35,
});

if (import.meta.env.DEV) {
  socket.on('connect', () => console.info('[socket] connected', socket.id));
  socket.on('connect_error', (error) => console.warn('[socket] connect error:', error.message));
  socket.on('disconnect', (reason) => console.info('[socket] disconnected:', reason));
}
