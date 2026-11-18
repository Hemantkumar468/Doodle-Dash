import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();
healthRouter.get('/', (_request, response) => {
  response.json({
    ok: true,
    status: 'ok',
    database: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    uptime: Math.floor(process.uptime())
  });
});
