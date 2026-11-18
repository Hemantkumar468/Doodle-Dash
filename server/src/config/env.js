import 'dotenv/config';

const integer = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

const boolean = (name, fallback) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  if (String(raw).toLowerCase() === 'true') return true;
  if (String(raw).toLowerCase() === 'false') return false;
  throw new Error(`${name} must be true or false`);
};

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: integer('PORT', 5000, { min: 1, max: 65535 }),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skribbl_clone',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  LOBBY_GRACE_MS: integer('LOBBY_GRACE_MS', 10_000),
  GAME_GRACE_MS: integer('GAME_GRACE_MS', 30_000),
  DRAWER_GRACE_MS: integer('DRAWER_GRACE_MS', 15_000),
  HISTORY_RETENTION_DAYS: integer('HISTORY_RETENTION_DAYS', 30, { min: 1, max: 3650 }),
  HISTORY_STORE_STROKES: boolean('HISTORY_STORE_STROKES', true)
});

export const maskMongoUri = (uri) => {
  try {
    const parsed = new URL(uri);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<invalid MongoDB URI>';
  }
};

const privateV4 = /^(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

export const isAllowedOrigin = (origin, config = env) => {
  if (!origin) return true;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (config.NODE_ENV === 'production') {
    return config.CLIENT_URL.split(',').map((v) => v.trim().replace(/\/$/, '')).includes(origin.replace(/\/$/, ''));
  }
  return parsed.port === '5173' && (
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || privateV4.test(parsed.hostname)
  );
};

export const corsOptions = (config = env) => ({
  origin(origin, callback) {
    callback(isAllowedOrigin(origin, config) ? null : new Error('Origin is not allowed by CORS'), isAllowedOrigin(origin, config));
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Device-Id']
});
