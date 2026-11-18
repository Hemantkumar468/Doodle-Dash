import mongoose from 'mongoose';
import { env } from '../config/env.js';

const strokeSchema = new mongoose.Schema({
  _id: false,
  color: { type: String, maxlength: 7 },
  size: { type: Number, min: 1, max: 80 },
  tool: { type: String, enum: ['brush', 'eraser'] },
  points: { type: [[Number]], default: [] }
});

const guesserSchema = new mongoose.Schema({
  _id: false,
  name: { type: String, maxlength: 24 },
  points: { type: Number, min: 0 },
  guessedAtSec: { type: Number, min: 0 }
});

const turnSchema = new mongoose.Schema({
  _id: false,
  round: { type: Number, required: true, min: 1 },
  turnIndex: { type: Number, required: true, min: 0 },
  drawerName: { type: String, maxlength: 24 },
  word: { type: String, maxlength: 81 },
  guessers: { type: [guesserSchema], default: [] },
  drawerPoints: { type: Number, min: 0, default: 0 },
  strokes: { type: [strokeSchema], default: [] }
});

const historyPlayerSchema = new mongoose.Schema({
  _id: false,
  deviceId: { type: String, maxlength: 128 },
  name: { type: String, required: true, maxlength: 24 },
  avatar: { type: String, maxlength: 80 },
  finalScore: { type: Number, default: 0 },
  rank: { type: Number, required: true, min: 1 }
});

const gameHistorySchema = new mongoose.Schema({
  roomId: { type: String, required: true, maxlength: 6 },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  durationSec: { type: Number, required: true, min: 0 },
  endedEarly: { type: Boolean, default: false },
  settings: {
    rounds: { type: Number, min: 1 },
    drawTime: { type: Number, min: 1 },
    wordMode: { type: String, maxlength: 20 },
    wordCount: { type: Number, min: 1 },
    hints: { type: Number, min: 0 }
  },
  players: { type: [historyPlayerSchema], default: [] },
  winnerName: { type: String, maxlength: 24, default: '' },
  turns: { type: [turnSchema], default: [] }
}, { timestamps: true, versionKey: false });

gameHistorySchema.index({ 'players.deviceId': 1, endedAt: -1 });
gameHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: env.HISTORY_RETENTION_DAYS * 24 * 60 * 60 });

export { gameHistorySchema };
export const GameHistory = mongoose.models.GameHistory || mongoose.model('GameHistory', gameHistorySchema);
