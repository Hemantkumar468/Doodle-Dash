import { z } from 'zod';

const safeString = (maximum) => z.string().trim().min(1).max(maximum)
  .transform((value) => value.replace(/[<>\u0000-\u001F\u007F]/g, '').trim())
  .refine((value) => value.length > 0, { message: 'Text cannot be empty.' });
export const roomIdSchema = z.string().trim().length(6).transform((value) => value.toUpperCase());
export const avatarSchema = z.union([z.string(), z.number()]).transform(String).refine((value) => value.length <= 80);
export const deviceIdSchema = z.string().trim().min(32).max(128).regex(/^[a-zA-Z0-9._-]+$/);

export const settingsSchema = z.object({
  maxPlayers: z.number().int().min(2).max(20).optional(),
  rounds: z.number().int().min(2).max(10).optional(),
  drawTime: z.number().int().min(15).max(240).optional(),
  wordChoices: z.number().int().min(1).max(5).optional(),
  hints: z.number().int().min(0).max(5).optional(),
  wordMode: z.enum(['Normal', 'Hidden', 'Combination']).optional(),
  isPrivate: z.boolean().optional(),
  customWords: z.string().max(2000).optional()
}).strict();

export const schemas = {
  create_room: z.object({ hostName: safeString(24), avatar: avatarSchema, deviceId: deviceIdSchema.optional(), settings: settingsSchema.default({}) }).strict(),
  join_room: z.object({ roomId: roomIdSchema, playerName: safeString(24), avatar: avatarSchema, deviceId: deviceIdSchema.optional() }).strict(),
  rejoin_room: z.object({ roomId: roomIdSchema, playerId: z.string().uuid() }).strict(),
  leave_room: z.object({ roomId: roomIdSchema.optional() }).default({}),
  update_settings: z.object({ roomId: roomIdSchema.optional(), settings: settingsSchema }).strict().or(settingsSchema),
  ready_toggle: z.object({ roomId: roomIdSchema.optional(), ready: z.boolean().optional() }).strict().default({}),
  kick_player: z.object({ roomId: roomIdSchema.optional(), playerId: z.string().uuid() }).strict(),
  start_game: z.object({ roomId: roomIdSchema.optional(), playAgain: z.boolean().optional() }).strict().default({}),
  word_chosen: z.object({ roomId: roomIdSchema.optional(), word: z.string().trim().min(1).max(81) }).strict(),
  draw_start: z.object({
    roomId: roomIdSchema.optional(), strokeId: z.string().min(1).max(80).optional(), x: z.number().min(0).max(1), y: z.number().min(0).max(1),
    tool: z.enum(['brush', 'eraser']).default('brush'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#111111'),
    size: z.number().min(1).max(80)
  }).strict(),
  draw_move: z.object({ roomId: roomIdSchema.optional(), strokeId: z.string().min(1).max(80).optional(), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  draw_end: z.object({ roomId: roomIdSchema.optional(), strokeId: z.string().min(1).max(80).optional(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional() }).strict().default({}),
  canvas_clear: z.object({ roomId: roomIdSchema.optional() }).strict().default({}),
  draw_undo: z.object({ roomId: roomIdSchema.optional() }).strict().default({}),
  guess: z.object({ roomId: roomIdSchema.optional(), text: safeString(100) }).strict().or(safeString(100).transform((text) => ({ text }))),
  chat: z.object({ roomId: roomIdSchema.optional(), text: safeString(100) }).strict().or(safeString(100).transform((text) => ({ text })))
};
