export function safeText(value, fallback = '') {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value == null) return fallback;
  if (import.meta.env.DEV) console.warn('Ignored non-renderable value:', JSON.stringify(value));
  return fallback;
}
