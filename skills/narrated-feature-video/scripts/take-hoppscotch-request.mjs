// Example run: Hoppscotch (hoppscotch.io, no sign-in). Types an endpoint, sends it, scrolls the response, then
// generates the same request as Python. 30.5 s with the voice in lines-hoppscotch-request.json.
// Run from a work dir with playwright-core: NFV_KIT=<this skill folder>/scripts/rec.mjs node <this file>
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
const { chromium } = createRequire(`${process.cwd()}/`)('playwright-core');
const { CURSOR_SCRIPT, MASK_SCRIPT, Recorder, human, moves, settle } = await import(
  process.env.NFV_KIT ?? `${os.homedir()}/.claude/skills/narrated-feature-video/scripts/rec.mjs`);

const NAME = 'hoppscotch-request';
const START_URL = 'https://hoppscotch.io';
const MASKS = { blur: [], blurInputs: [], hide: [], css: '' };

process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
setTimeout(() => { console.error('take timed out'); process.exit(1); }, 5 * 60 * 1000).unref();
fs.mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-device-scale-factor=1.5'] });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light' });
await ctx.addInitScript(CURSOR_SCRIPT);
await ctx.addInitScript(MASK_SCRIPT, MASKS);

const page = await ctx.newPage();
await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
await page.locator('button', { hasText: /^Send$/ }).waitFor({ timeout: 60000 });
await settle(page);

const start = [1180, 420];
await page.mouse.move(...start);
const h = human(page, start);
const rec = new Recorder(`out/rec-${NAME}`);
await rec.attach(page);
await rec.hold(1000);

await rec.mark('intro');
const url = page.locator('.cm-content').first();
await h.hover(url, 1000);
await rec.mark('url');
await h.click(url, 300);
await page.keyboard.press('Meta+A');
await h.type('https://api.github.com/repos/hoppscotch/hoppscotch', 40);
await page.waitForTimeout(400);
await rec.mark('send');
await h.click(page.locator('button', { hasText: /^Send$/ }), 900);
await page.getByText('Status:').first().waitFor();
await h.hover(page.getByText('Status:').first(), 900);
await h.hover(page.getByText('Time:').first(), 700);
await rec.mark('response');
const body = page.getByText('"full_name"').first();
await h.hover(body, 700);
await h.scroll(1150, 1700);
await h.hover(page.locator('.cm-line', { hasText: '"stargazers_count"' }).first(), 1000);
await rec.mark('code');
await h.click(page.locator('button[aria-label="Generate Code"]'), 1200);
await h.hover(page.locator('.cm-content').last(), 1000, true);
await rec.mark('lang');
await h.click(page.getByText('Shell - cURL').first(), 700);
await h.click(page.getByPlaceholder('Search').last(), 200);
await h.type('python', 90);
await page.waitForTimeout(500);
await h.click(page.getByText('Python - Requests').first(), 1000);
await h.hover(page.locator('.cm-content').last(), 1200, true);
await rec.mark('end');
await h.hover(page.locator('.cm-line').last(), 600);
await rec.detach();
await browser.close();
rec.encode(`out/video-${NAME}.mp4`);
fs.writeFileSync(`out/moves-${NAME}.json`, JSON.stringify(moves));
