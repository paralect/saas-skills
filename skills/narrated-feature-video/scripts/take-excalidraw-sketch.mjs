// Example run: Excalidraw (excalidraw.com, no sign-in). Draws two boxes with text, binds an arrow between them, then
// moves a box so the arrow follows. The Excalidraw+ promo is hidden. 22 s with lines-excalidraw-sketch.json.
// Run from a work dir with playwright-core: NFV_KIT=<this skill folder>/scripts/rec.mjs node <this file>
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
const { chromium } = createRequire(`${process.cwd()}/`)('playwright-core');
const { CURSOR_SCRIPT, MASK_SCRIPT, Recorder, human, moves, settle } = await import(
  process.env.NFV_KIT ?? `${os.homedir()}/.claude/skills/narrated-feature-video/scripts/rec.mjs`);

const NAME = 'excalidraw-sketch'
const START_URL = 'https://excalidraw.com';
const MASKS = { blur: [], blurInputs: [], hide: [], css: '.plus-banner { display: none !important }' };

process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
setTimeout(() => { console.error('take timed out'); process.exit(1); }, 5 * 60 * 1000).unref();
fs.mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-device-scale-factor=1.5'] });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light' });
await ctx.addInitScript(CURSOR_SCRIPT);
await ctx.addInitScript(MASK_SCRIPT, MASKS);

const page = await ctx.newPage();
await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Rectangle' }).waitFor({ timeout: 60000 });
await settle(page);

const start = [1180, 560];
await page.mouse.move(...start);
const h = human(page, start);
const rec = new Recorder(`out/rec-${NAME}`);
await rec.attach(page);
await rec.hold(1000);

const drag = async (from, to) => { await h.moveTo(...from); await page.waitForTimeout(150); await page.mouse.down(); await h.moveTo(...to); await page.mouse.up(); await page.waitForTimeout(400); };
const box = async ([x1, y1], [x2, y2], text) => {
  await h.click(page.getByRole('button', { name: 'Rectangle' }), 300, true);
  await drag([x1, y1], [x2, y2]);
  await page.keyboard.press('Enter');
  await h.type(text, 110);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};
await rec.mark('intro');
await h.hover(page.getByRole('button', { name: 'Rectangle' }), 900, true);
await h.hover(page.getByRole('button', { name: 'Arrow' }), 700, true);
await rec.mark('box');
await box([470, 290], [720, 410], 'Idea');
await rec.mark('box2');
await box([1000, 290], [1250, 410], 'Launch');
await rec.mark('arrow');
await h.click(page.getByRole('button', { name: 'Arrow' }), 300, true);
await drag([727, 350], [993, 350]);
await page.keyboard.press('Escape');
await h.moveTo(860, 470); await page.waitForTimeout(600);
await rec.mark('move');
await drag([1125, 350], [1185, 540]);
await page.waitForTimeout(700);
await page.keyboard.press('Escape');
await rec.mark('end');
await h.moveTo(1380, 560);
await page.waitForTimeout(900);
await rec.detach();
await browser.close();
rec.encode(`out/video-${NAME}.mp4`);
fs.writeFileSync(`out/moves-${NAME}.json`, JSON.stringify(moves));
