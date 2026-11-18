import express from 'express';
import cors from 'cors';
import { createServer as createHttpServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOptions, env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { roomsRouter } from './routes/rooms.js';
import { historyRouter } from './routes/history.js';
import { roomManager } from './game/RoomManager.js';
import { MessageHandler } from './sockets/MessageHandler.js';

export function createApp({ manager = roomManager, config = env } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(config)));
  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_request, response) => response.json({ name: 'skribbl-clone-server', status: 'ok' }));
  app.use('/health', healthRouter);
  app.use('/rooms', roomsRouter(manager));
  app.use('/api/history', historyRouter());
  app.use((_request, response) => response.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' }));
  app.use((error, _request, response, _next) => {
    console.error('HTTP request failed:', error?.message || error);
    response.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
  });
  return app;
}

export function createRealtimeServer({ manager = roomManager, config = env } = {}) {
  const app = createApp({ manager, config });
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: corsOptions(config),
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 100_000,
    pingTimeout: 20_000,
    pingInterval: 25_000
  });
  manager.configure({
    io,
    grace: { lobby: config.LOBBY_GRACE_MS, game: config.GAME_GRACE_MS, drawer: config.DRAWER_GRACE_MS }
  });
  const handler = new MessageHandler(io, manager);
  io.on('connection', (socket) => handler.attach(socket));
  return { app, httpServer, io, manager };
}
