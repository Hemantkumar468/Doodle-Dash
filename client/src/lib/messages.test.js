import { describe, expect, it } from 'vitest';
import { getErrorCode, getFriendlyError, messages } from './messages';

describe('friendly client errors', () => {
  it('maps code strings and server error objects without exposing raw text', () => {
    expect(getFriendlyError('ROOM_NOT_FOUND')).toBe(messages.errors.roomNotFound);
    expect(getFriendlyError({ code: 'ROOM_FULL', message: 'capacity=8' })).toBe(messages.errors.roomFull);
    expect(getFriendlyError({ error: { code: 'NOT_DRAWER' } })).toBe(messages.errors.notDrawer);
  });

  it('recognizes connection failures and timeouts', () => {
    expect(getErrorCode(new Error('network connection failed'))).toBe('CONNECT_ERROR');
    expect(getFriendlyError('network error')).toBe(messages.errors.connect);
    expect(getFriendlyError(new Error('request timed out'))).toBe(messages.errors.noResponse);
  });

  it('uses one safe default for missing, unknown, and raw technical values', () => {
    for (const value of [null, undefined, {}, { code: 'DATABASE_EXPLODED', message: 'undefined payload' }, new Error('raw object failure')]) {
      expect(getFriendlyError(value)).toBe(messages.errors.unknown);
    }
  });
});
