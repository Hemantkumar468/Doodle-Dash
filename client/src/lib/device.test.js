import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_ID_STORAGE_KEY, getDeviceId } from './device';

describe('device identity', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('creates one long device id and keeps it on this device', () => {
    const first = getDeviceId();
    const second = getDeviceId();
    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9._-]{32,128}$/);
    expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(first);
  });

  it('replaces a malformed saved id', () => {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'not a valid device id');
    const value = getDeviceId();
    expect(value).toMatch(/^[A-Za-z0-9._-]{32,128}$/);
    expect(value).not.toBe('not a valid device id');
    expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(value);
  });

  it('creates a stable nonzero fallback when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    const first = getDeviceId();
    const second = getDeviceId();
    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9._-]{32,128}$/);
    expect(first).not.toMatch(/^0+$/);
  });
});
