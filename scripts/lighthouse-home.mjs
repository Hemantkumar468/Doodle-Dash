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

const profiles = [
  {
    name: 'mobile',
    viewport: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    settings: { formFactor: 'mobile', screenEmulation: { mobile: true, width: 360, height: 800, deviceScaleFactor: 2, disabled: false } },
  },
  {
    name: 'desktop',
    viewport: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1366, height: 768, deviceScaleFactor: 1, disabled: false } },
  },
];

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--no-first-run', '--no-sandbox'],
});

try {
  for (const profile of profiles) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport(profile.viewport);
    const flow = await startFlow(page, {
      name: `${messages.brand.name} Home — ${profile.name}`,
      configContext: { settingsOverrides: { ...profile.settings, throttlingMethod: 'provided' } },
    });
    await flow.navigate(BASE_URL, { stepName: `Load Home on ${profile.name}` });
    await flow.snapshot({ name: `Home accessibility on ${profile.name}` });
    const result = await flow.createFlowResult();
    const html = await flow.generateReport();
    writeFileSync(path.join(ARTIFACTS, `lighthouse-home-${profile.name}.report.html`), html);
    writeFileSync(path.join(ARTIFACTS, `lighthouse-home-${profile.name}.json`), `${JSON.stringify(result, null, 2)}\n`);
    const navigation = result.steps.find((step) => step.lhr)?.lhr;
    const scores = Object.fromEntries(Object.entries(navigation?.categories || {}).map(([key, value]) => [key, value.score]));
    console.log(`${profile.name} Home Lighthouse: ${JSON.stringify(scores)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
