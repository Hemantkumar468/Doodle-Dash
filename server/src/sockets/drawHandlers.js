import { emitError } from './MessageHandler.js';
import { requireDrawer } from './helpers.js';
import { randomUUID } from 'node:crypto';

const ok = (ack) => { if (typeof ack === 'function') ack({ ok: true }); };

export function registerDrawHandlers({ socket, manager, register }) {
  register('draw_start', (payload, ack) => {
    const result = requireDrawer(socket, manager, ack);
    if (!result) return;
    const stroke = result.room.game.addStroke({ ...payload, strokeId: payload.strokeId || randomUUID() });
    socket.to(result.room.roomId).emit('draw_data', { type: 'start', ...stroke, points: [stroke.points[0]] });
    ok(ack);
  });

  register('draw_move', (payload, ack) => {
    const result = requireDrawer(socket, manager, ack);
    if (!result) return;
    const update = result.room.game.moveStroke(payload);
    if (!update) return emitError(socket, 'INVALID_PAYLOAD', 'Start a stroke before moving it.', ack);
    if (update.added) socket.to(result.room.roomId).emit('draw_data', { type: 'move', strokeId: update.stroke.id, x: payload.x, y: payload.y });
    ok(ack);
  });

  register('draw_end', (payload, ack) => {
    const result = requireDrawer(socket, manager, ack);
    if (!result) return;
    let strokeId = payload.strokeId;
    if (payload.x !== undefined && payload.y !== undefined) {
      const update = result.room.game.moveStroke(payload);
      if (update) {
        strokeId ||= update.stroke.id;
        if (update.added) socket.to(result.room.roomId).emit('draw_data', { type: 'move', strokeId: update.stroke.id, x: payload.x, y: payload.y });
      }
    }
    result.room.game.endStroke();
    socket.to(result.room.roomId).emit('draw_data', { type: 'end', strokeId });
    ok(ack);
  });

  register('canvas_clear', (_payload, ack) => {
    const result = requireDrawer(socket, manager, ack);
    if (!result) return;
    result.room.game.clearCanvas();
    result.room.broadcast('canvas_clear', {});
    ok(ack);
  });

  register('draw_undo', (_payload, ack) => {
    const result = requireDrawer(socket, manager, ack);
    if (!result) return;
    result.room.game.undo();
    result.room.broadcast('draw_undo', { strokeHistory: result.room.game.strokeHistory });
    ok(ack);
  });
}
