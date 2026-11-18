const DEVICE_KEY = 'doodle-dash-device-id';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._-]{32,128}$/;
let memoryDeviceId = '';

function isValidDeviceId(value) {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

function createDeviceId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    const uuid = cryptoApi.randomUUID();
    if (isValidDeviceId(uuid)) return uuid;
  }
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(24);
    cryptoApi.getRandomValues(bytes);
    return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  }

  // Web Crypto is unavailable in a few older or restricted browsers. Keep a
  // long per-device fallback instead of accidentally returning zero-filled bytes.
  const randomPart = Array.from({ length: 5 }, () => Math.random().toString(36).slice(2).padEnd(10, '0')).join('');
  return `fallback-${Date.now().toString(36)}-${randomPart}`.slice(0, 128);
}

export function getDeviceId() {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (isValidDeviceId(saved)) {
      memoryDeviceId = saved;
      return saved;
    }
    const value = createDeviceId();
    localStorage.setItem(DEVICE_KEY, value);
    memoryDeviceId = value;
    return value;
  } catch {
    if (!isValidDeviceId(memoryDeviceId)) memoryDeviceId = createDeviceId();
    return memoryDeviceId;
  }
}

export const DEVICE_ID_STORAGE_KEY = DEVICE_KEY;
