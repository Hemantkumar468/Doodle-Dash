import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { messages } from '../client/src/lib/messages.js';

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5173';
const base = new URL(BASE_URL);
const API_URL = process.env.AUDIT_API_URL || `${base.protocol}//${base.hostname}:5000`;
const ARTIFACTS = path.join(process.cwd(), 'artifacts', 'history-audit');
const DEVICE_KEY = 'doodle-dash-device-id';
const VIEWPORTS = [
  { width: 360, height: 800, name: '360x800' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1366, height: 768, name: '1366x768' },
];
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH and retry.');
mkdirSync(ARTIFACTS, { recursive: true });

const report = {
  baseUrl: BASE_URL,
  apiUrl: API_URL,
  game: {},
  devices: {},
  layouts: {},
  privacy: {},
  replay: {},
  deletion: {},
  console: [],
  failedResponses: [],
};

function observe(page, label) {
  page.on('console', (message) => {
    if (message.text().startsWith('Canvas2D: Multiple readback operations using getImageData')) return;
    if (['warning', 'error'].includes(message.type())) {
      report.console.push({ page: label, type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => report.console.push({ page: label, type: 'pageerror', text: error.message }));
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResponses.push({ page: label, status: response.status(), url: response.url() });
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function waitForDrawer(players, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    for (const player of players) {
      if (await player.page.getByRole('dialog', { name: messages.wordPicker.title }).isVisible().catch(() => false)) return player;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('No player received the word picker before timeout.');
}

async function currentWord(page) {
  const labels = { label: messages.game.yourWord, waiting: messages.game.chooseWord };
  await page.waitForFunction(({ label, waiting }) => {
    const heading = [...document.querySelectorAll('p')].find((item) => item.textContent?.trim() === label);
    const value = heading?.nextElementSibling?.textContent?.trim();
    return value && value !== waiting;
  }, labels);
  return page.evaluate(({ label }) => {
    const heading = [...document.querySelectorAll('p')].find((item) => item.textContent?.trim() === label);
    return heading?.nextElementSibling?.textContent?.trim();
  }, labels);
}

async function drawStroke(page, turn) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('The drawer canvas was not visible.');
  const offset = (turn % 3) * 0.08;
  await page.mouse.move(box.x + box.width * 0.14, box.y + box.height * (0.25 + offset));
  await page.mouse.down();
  for (let step = 1; step <= 36; step += 1) {
    await page.mouse.move(
      box.x + box.width * (0.14 + step * 0.018),
      box.y + box.height * (0.32 + offset + Math.sin(step / 3) * 0.13),
      { steps: 1 },
    );
  }
  await page.mouse.up();
}

async function submitGuess(page, word) {
  const input = page.locator('[data-keyboard-anchor]');
  await input.fill(word);
  await input.press('Enter');
}

async function readDeviceId(page) {
  const value = await page.evaluate((key) => localStorage.getItem(key), DEVICE_KEY);
  if (!value || value.length < 24) throw new Error('A persistent device ID was not created.');
  return value;
}

async function apiRequest(player, method, pathname) {
  const response = await player.context.request.fetch(`${API_URL}${pathname}`, {
    method,
    headers: { 'X-Device-Id': player.deviceId },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status(), body, text };
}

async function waitForHistory(player, timeout = 12_000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    last = await apiRequest(player, 'GET', '/api/history?limit=20');
    if (last.status === 200 && last.body?.games?.length) return last;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${player.name} did not receive the completed game in history: ${JSON.stringify(last)}`);
}

function assertPrivatePayload(payload, label) {
  const text = JSON.stringify(payload);
  if (/"deviceId"\s*:/i.test(text)) throw new Error(`${label} exposed a deviceId.`);
}

async function auditLayout(page, screen) {
  report.layouts[screen] ||= {};
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await settle(page);
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
      };
      const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, summary, [role="button"]')]
        .filter(visible)
        .filter((element) => !element.classList.contains('sr-only'));
      const tooSmall = controls.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 50) || '',
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        };
      }).filter((control) => control.width < 43.5 || control.height < 43.5);
      const scrollWidth = Math.max(root.scrollWidth, document.body?.scrollWidth || 0);
      const sidebar = document.querySelector('aside');
      return {
        innerWidth: window.innerWidth,
        scrollWidth,
        horizontalOverflow: scrollWidth > window.innerWidth + 1,
        tooSmall,
        sidebarVisible: Boolean(sidebar && visible(sidebar)),
      };
    });
    report.layouts[screen][viewport.name] = metrics;
    if (metrics.horizontalOverflow || metrics.tooSmall.length) {
      throw new Error(`${screen} failed at ${viewport.name}: ${JSON.stringify(metrics)}`);
    }
    if (screen === 'details' && metrics.sidebarVisible !== (viewport.width >= 1024)) {
      throw new Error(`The history details sidebar visibility was wrong at ${viewport.name}.`);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, `${screen}-${viewport.name}.png`), fullPage: true });
  }
}

async function expectEmpty(page) {
  await page.getByText(messages.history.emptyHint, { exact: true }).waitFor();
}

const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });
const contexts = [];

try {
  for (const [index, name] of ['Alice History', 'Bob History', 'Cara History'].entries()) {
    const context = await browser.newContext({
      viewport: index === 1 ? { width: 1366, height: 768 } : { width: 360, height: 800 },
      hasTouch: index !== 1,
      isMobile: index !== 1,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    observe(page, name);
    contexts.push({ context, page, name });
  }
  const [alice, bob, cara] = contexts;

  await alice.page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await alice.page.getByLabel(messages.fields.name.label).fill(alice.name);
  await alice.page.getByRole('button', { name: messages.home.createRoom }).click();
  await alice.page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const roomLabel = await alice.page.locator('[aria-label^="Room code "]').getAttribute('aria-label');
  const roomCode = roomLabel?.split(' ').at(-1);
  if (!roomCode) throw new Error('Could not read the created room code.');

  for (const player of [bob, cara]) {
    await player.page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await player.page.getByLabel(messages.fields.name.label).fill(player.name);
    await player.page.getByLabel(messages.fields.roomCode.label).fill(roomCode);
    await player.page.getByRole('button', { name: messages.home.joinWithCode }).click();
    await player.page.waitForURL(new RegExp(`/room/${roomCode}$`));
  }
  await alice.page.getByText(messages.lobby.online(3)).waitFor();
  for (const player of contexts) player.deviceId = await readDeviceId(player.page);
  if (new Set(contexts.map((player) => player.deviceId)).size !== 3) throw new Error('Browser contexts did not receive separate device IDs.');

  await alice.page.getByRole('button', { name: messages.a11y.decrease(messages.settings.rounds) }).click();
  await alice.page.getByRole('button', { name: messages.lobby.startGame }).click();
  await alice.page.locator('canvas').waitFor();

  const turns = [];
  for (let turn = 0; turn < 6; turn += 1) {
    const drawer = await waitForDrawer(contexts, turn === 0 ? 12_000 : 8_000);
    const picker = drawer.page.getByRole('dialog', { name: messages.wordPicker.title });
    await picker.getByRole('button').first().click();
    const word = await currentWord(drawer.page);
    await drawStroke(drawer.page, turn);
    const guessers = contexts.filter((player) => player !== drawer);
    // Drawing and guesses arrive over different sockets. Let the final stroke
    // reach the server before a correct guess ends the turn.
    await drawer.page.waitForTimeout(350);
    await submitGuess(guessers[0].page, word);
    await submitGuess(guessers[1].page, word);
    await alice.page.getByRole('dialog', { name: messages.roundEnd.title }).waitFor({ timeout: 8_000 });
    turns.push({ turn: turn + 1, drawer: drawer.name, word, guessers: guessers.map((player) => player.name) });
  }

  await alice.page.getByText(messages.gameOver.title, { exact: true }).waitFor({ timeout: 12_000 });
  await Promise.all([bob, cara].map((player) => player.page.getByText(messages.gameOver.title, { exact: true }).waitFor({ timeout: 5_000 })));
  report.game = { roomCode, turns };

  const histories = await Promise.all(contexts.map((player) => waitForHistory(player)));
  const summaries = histories.map((response, index) => {
    assertPrivatePayload(response.body, `${contexts[index].name}'s history list`);
    if (/"strokes"\s*:/i.test(response.text)) throw new Error('A history list response included strokes.');
    return response.body.games[0];
  });
  const gameId = summaries[0].id;
  if (!gameId || summaries.some((summary) => summary.id !== gameId)) throw new Error('The three devices did not receive the same game record.');

  await alice.page.getByRole('button', { name: messages.history.viewGame }).click();
  await alice.page.waitForURL(new RegExp(`/history/${gameId}$`));
  await alice.page.getByRole('heading', { name: messages.history.roomCode(roomCode) }).waitFor();
  report.game.gameOverLinkOpenedSavedGame = true;

  for (const [index, player] of contexts.entries()) {
    const summary = summaries[index];
    report.devices[player.name] = { rank: summary.myRank, score: summary.myScore };
    await player.page.goto(`${BASE_URL}/history`, { waitUntil: 'networkidle' });
    await player.page.getByRole('heading', { name: messages.history.title }).waitFor();
    await player.page.getByText(messages.history.youPlaced(summary.myRank, summary.myScore), { exact: true }).waitFor();
    await player.page.getByText(messages.history.deviceNote, { exact: true }).waitFor();
  }

  await auditLayout(alice.page, 'list');

  await alice.page.goto(`${BASE_URL}/history/${gameId}`, { waitUntil: 'networkidle' });
  await alice.page.getByRole('heading', { name: messages.history.roomCode(roomCode) }).waitFor();
  await alice.page.getByRole('heading', { name: messages.history.leaderboard }).waitFor();
  for (const player of contexts) await alice.page.getByText(player.name, { exact: true }).first().waitFor();

  const detailResponse = await apiRequest(alice, 'GET', `/api/history/${gameId}`);
  if (detailResponse.status !== 200) throw new Error(`History details returned ${detailResponse.status}.`);
  assertPrivatePayload(detailResponse.body, 'History details');
  if (detailResponse.body?.game?.players?.length !== 3 || detailResponse.body?.game?.turns?.length !== 6) {
    throw new Error(`History details were incomplete: ${detailResponse.text}`);
  }
  report.game.strokeCounts = detailResponse.body.game.turns.map((turn) =>
    (turn.strokes || []).reduce((count, stroke) => count + (stroke.points?.length || 0), 0));
  if (report.game.strokeCounts.some((count) => count < 2)) {
    throw new Error(`One or more completed drawings were not saved: ${JSON.stringify(report.game.strokeCounts)}`);
  }
  report.privacy.listHasStrokes = false;
  report.privacy.deviceIdsExposed = false;

  const outsiderId = randomUUID();
  const outsider = await alice.context.request.get(`${API_URL}/api/history/${gameId}`, { headers: { 'X-Device-Id': outsiderId } });
  if (outsider.status() !== 404) throw new Error(`An unrelated device received ${outsider.status()} instead of 404.`);
  report.privacy.unrelatedDeviceStatus = outsider.status();

  const firstTurn = alice.page.locator('details').first();
  if (!await firstTurn.evaluate((element) => element.open)) await firstTurn.locator('summary').click();
  const replay = firstTurn.getByRole('region', { name: messages.history.replay.region });
  await replay.waitFor();
  const progress = replay.getByRole('slider', { name: messages.history.replay.progress });
  await replay.getByRole('button', { name: messages.history.replay.speedOption(4) }).click();
  if (await replay.getByRole('button', { name: messages.history.replay.speedOption(4) }).getAttribute('aria-pressed') !== 'true') {
    throw new Error('Replay speed did not change to 4x.');
  }
  await replay.getByRole('button', { name: messages.history.replay.speedOption(1) }).click();
  await replay.getByRole('button', { name: messages.history.replay.play }).click();
  await alice.page.waitForFunction(() => Number(document.querySelector('[aria-label="Replay progress"]')?.value) > 0);
  const progressedTo = Number(await progress.inputValue());
  const pause = replay.getByRole('button', { name: messages.history.replay.pause });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  await progress.fill(String(Math.max(1, Math.floor(Number(await progress.getAttribute('max')) / 2))));
  await replay.getByRole('button', { name: messages.history.replay.restart }).click();
  if (Number(await progress.inputValue()) !== 0) throw new Error('Replay restart did not reset progress.');

  const downloadPromise = alice.page.waitForEvent('download');
  await replay.getByRole('button', { name: messages.history.replay.saveImage }).click();
  const download = await downloadPromise;
  if (!/^drawing-.+-\d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename())) {
    throw new Error(`Unexpected replay filename: ${download.suggestedFilename()}`);
  }
  report.replay = { progressedTo, filename: download.suggestedFilename(), speeds: [1, 2, 4] };
  await download.delete().catch(() => {});

  await auditLayout(alice.page, 'details');

  await alice.page.getByRole('button', { name: messages.history.deleteGame }).click();
  const deleteDialog = alice.page.getByRole('dialog', { name: messages.history.deleteTitle });
  await deleteDialog.getByRole('button', { name: messages.history.deleteConfirm }).click();
  await alice.page.waitForURL(/\/history$/);
  await expectEmpty(alice.page);
  const aliceAfterDelete = await apiRequest(alice, 'GET', `/api/history/${gameId}`);
  if (aliceAfterDelete.status !== 404) throw new Error('Alice kept access after deleting the game.');

  const bobAfterAliceDelete = await apiRequest(bob, 'GET', `/api/history/${gameId}`);
  if (bobAfterAliceDelete.status !== 200 || bobAfterAliceDelete.body?.game?.players?.length !== 3) {
    throw new Error(`Alice's deletion damaged Bob's complete leaderboard: ${bobAfterAliceDelete.text}`);
  }
  await bob.page.goto(`${BASE_URL}/history/${gameId}`, { waitUntil: 'networkidle' });
  for (const player of contexts) await bob.page.getByText(player.name, { exact: true }).first().waitFor();

  await bob.page.goto(`${BASE_URL}/history`, { waitUntil: 'networkidle' });
  await bob.page.getByRole('button', { name: messages.history.clearAll }).click();
  const bobClear = bob.page.getByRole('dialog', { name: messages.history.clearTitle });
  await bobClear.getByRole('button', { name: messages.history.clearConfirm }).click();
  await expectEmpty(bob.page);
  const bobAfterClear = await apiRequest(bob, 'GET', `/api/history/${gameId}`);
  if (bobAfterClear.status !== 404) throw new Error('Bob kept access after clearing history.');

  const caraAfterBobClear = await apiRequest(cara, 'GET', `/api/history/${gameId}`);
  if (caraAfterBobClear.status !== 200 || caraAfterBobClear.body?.game?.players?.length !== 3) {
    throw new Error(`Bob's clear damaged Cara's complete leaderboard: ${caraAfterBobClear.text}`);
  }
  await cara.page.goto(`${BASE_URL}/history`, { waitUntil: 'networkidle' });
  await cara.page.getByRole('button', { name: messages.history.clearAll }).click();
  const caraClear = cara.page.getByRole('dialog', { name: messages.history.clearTitle });
  await caraClear.getByRole('button', { name: messages.history.clearConfirm }).click();
  await expectEmpty(cara.page);
  const caraAfterClear = await apiRequest(cara, 'GET', `/api/history/${gameId}`);
  if (caraAfterClear.status !== 404) throw new Error('Cara kept access after clearing history.');

  report.deletion = {
    deleteOneRemovedOnlyAlice: true,
    clearAllRemovedOnlyBob: true,
    finalDeviceClearRemovedRecord: true,
    leaderboardPreservedForRemainingDevices: true,
  };

  if (report.console.length) throw new Error(`Browser console warnings/errors: ${JSON.stringify(report.console)}`);
  report.passed = true;
  writeFileSync(path.join(ARTIFACTS, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`History browser audit passed. Report: ${path.join(ARTIFACTS, 'report.json')}`);
} catch (error) {
  report.passed = false;
  report.failure = error.stack || error.message;
  const cleanup = await Promise.allSettled(contexts
    .filter((player) => player.deviceId)
    .map((player) => apiRequest(player, 'DELETE', '/api/history')));
  report.failureCleanup = cleanup.map((result) => result.status === 'fulfilled'
    ? { status: result.value.status }
    : { error: result.reason?.message || String(result.reason) });
  writeFileSync(path.join(ARTIFACTS, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  await Promise.all(contexts.map(({ context }) => context.close().catch(() => {})));
  await browser.close();
}
