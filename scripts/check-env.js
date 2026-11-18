import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, '..');

function readEnv(relativePath) {
  const filePath = path.join(rootDirectory, relativePath);
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const rawValue = line.slice(separator + 1).trim();
        const value = rawValue.replace(/^(['\"])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

function fail(message) {
  console.error(`[check:env] ${message}`);
  process.exitCode = 1;
}

const serverEnv = readEnv('server/.env');
const clientEnv = readEnv('client/.env');
const serverPort = String(serverEnv.PORT || '5000');

if (!/^\d+$/.test(serverPort) || Number(serverPort) < 1 || Number(serverPort) > 65535) {
  fail(`server PORT must be an integer from 1 to 65535; received "${serverPort}".`);
} else if (clientEnv.VITE_SERVER_URL) {
  try {
    const serverUrl = new URL(clientEnv.VITE_SERVER_URL);
    const urlPort = serverUrl.port || (serverUrl.protocol === 'https:' ? '443' : '80');
    if (urlPort !== serverPort) {
      fail(
        `Port mismatch: server/.env uses ${serverPort}, but client/.env VITE_SERVER_URL points to ${urlPort}.`,
      );
    }
  } catch {
    fail('client/.env VITE_SERVER_URL must be an absolute http:// or https:// URL.');
  }
}

if (!process.exitCode) {
  console.log(
    `[check:env] OK - server port ${serverPort}; client ${
      clientEnv.VITE_SERVER_URL ? 'uses VITE_SERVER_URL' : 'uses its hostname fallback'
    }.`,
  );
}
