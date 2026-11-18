import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';
import { startFlow } from 'lighthouse';
import { messages } from '../client/src/lib/messages.js';

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5173';
const ARTIFACTS = path.join(process.cwd(), 'artifacts', 'mobile-audit');
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH and retry.');
mkdirSync(ARTIFACTS, { recursive: true });

async function fill(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(selector, (element) => {
    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.type(selector, value);
}

async function clickButton(page, label) {
  await page.waitForFunction(
    (text) => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim().includes(text)),
    { timeout: 10_000 },
    label,
  );
  await page.evaluate((text) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim().includes(text));
    button?.click();
  }, label);
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (value) => document.body.textContent?.includes(value),
    { timeout: 12_000 },
    text,
  );
}

async function waitForDrawer(pages) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    for (const page of pages) {
      if (await page.$('[role="dialog"] button')) return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The word picker did not appear.');
}

async function prepareGameInteraction(page, isDrawer) {
  if (!isDrawer) {
    const input = await page.waitForSelector('[data-keyboard-anchor]', { visible: true });
    return { input };
  }

  const canvas = await page.waitForSelector('canvas', { visible: true });
  const box = await canvas.boundingBox();
  return { box };
}

async function interactWithGame(page, isDrawer, prepared) {
  if (!isDrawer) {
    await prepared.input.type('lighthouse interaction');
    await prepared.input.press('Enter');
    return;
  }

  const { box } = prepared;
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.65, { steps: 10 });
  await page.mouse.up();
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--no-first-run', '--no-sandbox'],
});

try {
  const aliceContext = await browser.createBrowserContext();
  const bobContext = await browser.createBrowserContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  await Promise.all([
    alice.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
    bob.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
  ]);

  await alice.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await fill(alice, `input[placeholder="${messages.fields.name.placeholder}"]`, 'Lighthouse Alice');
  await clickButton(alice, messages.home.createRoom);
  await alice.waitForFunction(() => /^\/room\/[A-Z2-9]{6}$/.test(location.pathname), { timeout: 10_000 });
  await waitForText(alice, messages.lobby.title);
  const roomCode = await alice.$eval('[aria-label^="Room code "]', (element) => element.getAttribute('aria-label')?.split(' ').at(-1));
  if (!roomCode) throw new Error('Could not read the room code.');

  await bob.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await fill(bob, `input[placeholder="${messages.fields.name.placeholder}"]`, 'Lighthouse Bob');
  await fill(bob, `input[placeholder="${messages.fields.roomCode.placeholder}"]`, roomCode);
  await clickButton(bob, messages.home.joinWithCode);
  await bob.waitForFunction((code) => location.pathname === `/room/${code}`, { timeout: 10_000 }, roomCode);
  await waitForText(alice, messages.lobby.online(2));

  await clickButton(alice, messages.lobby.startGame);
  const drawer = await waitForDrawer([alice, bob]);
  await drawer.$eval('[role="dialog"] button', (button) => button.click());
  await alice.waitForSelector('canvas', { visible: true });
  await alice.waitForFunction(
    (drawerLabel, guesserLabel) => document.body.textContent?.includes(drawerLabel) || document.body.textContent?.includes(guesserLabel),
    { timeout: 10_000 },
    messages.game.yourWord,
    messages.game.guessWord,
  );

  const flow = await startFlow(alice, {
    name: `${messages.brand.name} active game — mobile`,
    configContext: {
      settingsOverrides: {
        formFactor: 'mobile',
        throttlingMethod: 'provided',
        screenEmulation: { mobile: true, width: 360, height: 800, deviceScaleFactor: 2, disabled: false },
      },
    },
  });
  await flow.snapshot({ name: 'Active game accessibility and best practices' });
  const mobileInteraction = await prepareGameInteraction(alice, drawer === alice);
  await flow.startTimespan({ name: 'Active game interaction performance' });
  await interactWithGame(alice, drawer === alice, mobileInteraction);
  await alice.evaluate(() => {
    if (document.documentElement.scrollHeight > innerHeight + 2) throw new Error('The Game page scrolls vertically.');
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await flow.endTimespan();

  const flowResult = await flow.createFlowResult();
  const html = await flow.generateReport();
  writeFileSync(path.join(ARTIFACTS, 'lighthouse-game-mobile.report.html'), html);
  writeFileSync(path.join(ARTIFACTS, 'lighthouse-game-mobile.json'), `${JSON.stringify(flowResult, null, 2)}\n`);

  await alice.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const desktopFlow = await startFlow(alice, {
    name: `${messages.brand.name} active game — desktop`,
    configContext: {
      settingsOverrides: {
        formFactor: 'desktop',
        throttlingMethod: 'provided',
        screenEmulation: { mobile: false, width: 1366, height: 768, deviceScaleFactor: 1, disabled: false },
      },
    },
  });
  await desktopFlow.snapshot({ name: 'Desktop active game accessibility and best practices' });
  const desktopInteraction = await prepareGameInteraction(alice, drawer === alice);
  await desktopFlow.startTimespan({ name: 'Desktop active game interaction performance' });
  await interactWithGame(alice, drawer === alice, desktopInteraction);
  await alice.evaluate(() => {
    if (document.documentElement.scrollHeight > innerHeight + 2) throw new Error('The desktop Game page scrolls vertically.');
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await desktopFlow.endTimespan();
  const desktopResult = await desktopFlow.createFlowResult();
  const desktopHtml = await desktopFlow.generateReport();
  writeFileSync(path.join(ARTIFACTS, 'lighthouse-game-desktop.report.html'), desktopHtml);
  writeFileSync(path.join(ARTIFACTS, 'lighthouse-game-desktop.json'), `${JSON.stringify(desktopResult, null, 2)}\n`);
  console.log(`Lighthouse Game flows passed with ${flowResult.steps.length + desktopResult.steps.length} audited steps.`);

  await Promise.all([aliceContext.close(), bobContext.close()]);
} finally {
  await browser.close();
}
