// Example take: copy into your work dir as take-<feature>.mjs, then change the CONFIG and SCENES parts.
// Run: NFV_KIT=<this skill folder>/scripts/rec.mjs node take-<feature>.mjs
//   (work dir needs `npm i playwright-core`; Google Chrome must be installed)
// Writes out/video-<feature>.mp4 (2520x1080, 30 fps, silent) and out/moves-<feature>.json (for check-video.sh).
//
// This one records a real, public page so it runs anywhere: the Playwright docs, search for "screenshots".
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
const { chromium } = createRequire(`${process.cwd()}/`)('playwright-core');
const { CURSOR_SCRIPT, MASK_SCRIPT, Recorder, human, moves, settle } = await import(
  process.env.NFV_KIT ?? `${os.homedir()}/.claude/skills/narrated-feature-video/scripts/rec.mjs`);

// ---- CONFIG ---------------------------------------------------------------------------------------------------
const NAME = 'docs-search';
const START_URL = 'https://playwright.dev/docs/intro';
const STORAGE = null; // e.g. 'session.json': a saved, signed-in storageState. Never sign in from a take.
const MASKS = {
  blur: ['\\(\\d{3}\\) \\d{3}-\\d{4}', '[\\w.+-]+@[\\w-]+\\.[\\w.]+'], // phone numbers, emails (text nodes)
  blurInputs: ['input[type=tel]', 'input[type=email]'],
  hide: [], // regex sources: a block whose text starts with one of these is hidden (banners, notices)
  css: '', // e.g. 'mdn-ad, [id^=cookie], .survey { display: none !important }' for ads, cookie and survey pop-ups
};

process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
setTimeout(() => { console.error('take timed out'); process.exit(1); }, 5 * 60 * 1000).unref(); // never hang with Chrome open
fs.mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--force-device-scale-factor=1.5'] });
// 1680x720 CSS px at 1.5x = 2520x1080 frames: wide enough for a desktop app, short enough to read on a phone.
const ctx = await browser.newContext({ ...(STORAGE ? { storageState: STORAGE } : {}), viewport: { width: 1680, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light' });
await ctx.addInitScript(CURSOR_SCRIPT);
await ctx.addInitScript(MASK_SCRIPT, MASKS);
// Mocks go here, before the first page load. Examples (rewrite/json come from rec.mjs):
//   await ctx.route(/api\.app\.com\/reports\/sales/, (r) => json(r, demoSales));               // demo data
//   await ctx.route(/api\.app\.com\/users\/current/, (r) => rewrite(r, (t) => t.replaceAll(' (TEST)', '')));
//   await ctx.route(/api\.app\.com\/settings\/save/, (r) => json(r, {}));                      // a save that changes nothing
//   await ctx.route(/ads\.|telemetry|doubleclick/, (r) => r.abort());                         // ads and trackers

const page = await ctx.newPage();
await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 60000 });
await settle(page); // or settle(page, page.getByText('Some section'), 'start') to open further down the page

const start = [1180, 330];
await page.mouse.move(...start); // the only direct mouse call: before recording starts
const h = human(page, start);
const rec = new Recorder(`out/rec-${NAME}`);
await rec.attach(page);
await rec.hold(1000); // a beat on the opening screen

// ---- SCENES: one beat per voiceover line; hover what the line talks about, click what it does --------------------
// `await rec.mark('label')` at the start of each beat: encode() prints them on the video clock, for timing the voice.
// NFV_PROBE=1 node take-....mjs runs the same take without recording and screenshots every mark: use it to look at the
// real screens first, and for the cover.
// 1. The page, then the search box.
await rec.mark('page');
await h.hover(page.getByRole('heading', { level: 1 }).first(), 900);
await h.click(page.getByRole('button', { name: /search/i }).first(), 900);
// 2. Typing a query: the results update as you type.
await rec.mark('typing');
await h.type('screenshots', 90);
await page.waitForTimeout(1200);
const first = page.locator('.DocSearch-Hit').first();
await first.waitFor();
await h.hover(first, 1500);
// 3. Open the result.
await rec.mark('open result');
await h.click(first, 1200);
const heading = page.getByRole('heading', { level: 1 }).first();
await h.hover(heading, 1200);
// 4. Further down the page: scroll smoothly (cursor over the content), then point at what you scrolled to.
await rec.mark('scroll');
await h.scrollTo(page.getByRole('heading', { level: 2 }).nth(1), 220);
await h.hover(page.getByRole('heading', { level: 2 }).nth(1), 2000);
// A deliberate cut after a click that navigates (don't let h.click's default wait record the load):
//   await h.click(link, 150); rec.pause(); await page.getByRole('heading').first().waitFor(); await settle(page); await rec.resume(h.park());
// A deliberate cut, when the viewer needn't watch a page load:
//   rec.pause(); await page.goto(OTHER_URL); await page.getByText('Ready').waitFor(); await settle(page); await rec.resume(h.park());
await rec.mark('end');

await rec.detach();
await browser.close();
rec.encode(`out/video-${NAME}.mp4`); // prints and saves the marks in video time
fs.writeFileSync(`out/moves-${NAME}.json`, JSON.stringify(moves));
console.log(`done: out/video-${NAME}.mp4`);
