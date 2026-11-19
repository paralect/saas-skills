// Example run: Mermaid Live (mermaid.live, no sign-in). Closes the promo dialog and banner off camera, hides the
// corner toast, adds a branch to the flowchart as code, then switches samples. 21 s with lines-mermaid-live-edit.json.
// Run from a work dir with playwright-core: NFV_KIT=<this skill folder>/scripts/rec.mjs node <this file>
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
const { chromium } = createRequire(`${process.cwd()}/`)('playwright-core');
const { CURSOR_SCRIPT, MASK_SCRIPT, Recorder, human, moves, settle } = await import(
  process.env.NFV_KIT ?? `${os.homedir()}/.claude/skills/narrated-feature-video/scripts/rec.mjs`);

const NAME = 'mermaid-live-edit'
const START_URL = 'https://mermaid.live/edit';
const MASKS = { blur: [], blurInputs: [], hide: ['^Cutting carbs'], css: 'div.absolute.right-0.bottom-0 { display: none !important }' };

process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
setTimeout(() => { console.error('take timed out'); process.exit(1); }, 5 * 60 * 1000).unref();
fs.mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-device-scale-factor=1.5'] });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light' });
await ctx.addInitScript(CURSOR_SCRIPT);
await ctx.addInitScript(MASK_SCRIPT, MASKS);

const page = await ctx.newPage();
await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Stay in mermaid.live' }).click({ timeout: 60000 });
await page.locator('div.top-bar button').last().click();   // the promo banner's close button
await page.getByText('Laptop').last().waitFor();
await settle(page);

const start = [620, 420];
await page.mouse.move(...start);
const h = human(page, start);
const rec = new Recorder(`out/rec-${NAME}`);
await rec.attach(page);
await rec.hold(1000);

await rec.mark('intro');
await h.hover(page.getByText('A[Christmas]').first(), 900);
await h.hover(page.getByText('Christmas', { exact: true }).last(), 900, true);
await rec.mark('edit');
await h.click(page.getByText('F[fa:fa-car Car]').first(), 200, true);
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await h.type('C -->|Four| G[Tablet', 90);
await page.waitForTimeout(1200);
await h.hover(page.locator('svg').getByText('Tablet').last(), 1200, true);
await rec.mark('sample');
await h.click(page.locator('button', { hasText: /^Sequence$/ }).first(), 1200);
await h.hover(page.locator('.view-lines').first(), 900, true);
await rec.mark('mindmap');
await h.click(page.locator('button', { hasText: /^Mindmap$/ }).first(), 1500);
await rec.mark('end');
await h.moveTo(1100, 400);
await page.waitForTimeout(800);
await rec.detach();
await browser.close();
rec.encode(`out/video-${NAME}.mp4`);
fs.writeFileSync(`out/moves-${NAME}.json`, JSON.stringify(moves));
