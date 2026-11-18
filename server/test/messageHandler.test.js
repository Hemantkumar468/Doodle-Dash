import { describe, expect, it, vi } from 'vitest';
import { emitError, socketError } from '../src/sockets/MessageHandler.js';

describe('friendly socket error fallbacks', () => {
  it('keeps the code while replacing technical text with friendly copy', () => {
    expect(socketError('ROOM_NOT_FOUND', 'database lookup returned null')).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: "We couldn't find this room. Please check the code or ask your friend to send it again.",
    });
  });

  it('uses a safe message for unknown and validation errors', () => {
    expect(socketError('NEW_INTERNAL_CODE').message).toBe('Something went wrong on our side. Please try again.');
    expect(socketError('INVALID_PAYLOAD').message).not.toMatch(/payload|invalid/i);
  });

  it('emits and acknowledges the same safe shape', () => {
    const socket = { emit: vi.fn() };
    const ack = vi.fn();
    emitError(socket, 'INTERNAL_ERROR', 'Mongo connection dropped', ack);

    const safe = { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' };
    expect(socket.emit).toHaveBeenCalledWith('error_message', safe);
    expect(ack).toHaveBeenCalledWith({ ok: false, error: safe });
  });
});
