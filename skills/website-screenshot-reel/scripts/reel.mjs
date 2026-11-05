#!/usr/bin/env node
// Capture above-the-fold screenshots of websites and combine them into a crisp GIF or MOV.
// Usage: node reel.mjs [options] <url> [url...]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = { out: 'out/website-screenshot-reel/reel.gif', duration: 1, width: 1440, height: 900, scale: 2, wait: 12, outWidth: 0, fps: 30, shots: '', only: false };
const urls = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i];
  if (a === '--out' || a === '-o') opt.out = next();
  else if (a === '--duration') opt.duration = +next();
  else if (a === '--width') opt.width = +next();
  else if (a === '--height') opt.height = +next();
  else if (a === '--scale') opt.scale = +next();
  else if (a === '--wait') opt.wait = +next();
  else if (a === '--out-width') opt.outWidth = +next();
  else if (a === '--fps') opt.fps = +next();
  else if (a === '--shots') opt.shots = next();
  else if (a === '--help' || a === '-h') { console.log(execFileSync('sed', ['-n', '2,3p', fileURLToPath(import.meta.url)]).toString()); process.exit(0); }
  else urls.push(/^https?:\/\//.test(a) ? a : `https://${a}`);
}
if (!urls.length) { console.error('No URLs given'); process.exit(1); }

const out = resolve(opt.out);
mkdirSync(dirname(out), { recursive: true });
const ext = extname(out).toLowerCase();
if (!['.gif', '.mov', '.mp4'].includes(ext)) { console.error('--out must end in .gif, .mov or .mp4'); process.exit(1); }

// Ensure playwright + chromium are available
if (!existsSync(join(HERE, 'node_modules', 'playwright'))) {
  console.log('Installing playwright (first run)…');
  execFileSync('npm', ['install', '--silent'], { cwd: HERE, stdio: 'inherit' });
}
const { chromium } = await import(join(HERE, 'node_modules', 'playwright', 'index.mjs'));
let browser;
try { browser = await chromium.launch(); }
catch {
  execFileSync(join(HERE, 'node_modules', '.bin', 'playwright'), ['install', 'chromium'], { stdio: 'inherit' });
  browser = await chromium.launch();
}

const work = join(tmpdir(), `reel-${Date.now()}`);
const shotsDir = opt.shots ? resolve(opt.shots) : join(work, 'shots');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(join(work, 'frames'), { recursive: true });

const HIDE_CSS = `
#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,#CybotCookiebotDialogBodyUnderlay,.cky-consent-container,.cky-overlay,
#cookiescript_injected,.cc-window,.cc-banner,#cc-main,.cookie-banner,#cookie-banner,#cookie-notice,#usercentrics-root,.osano-cm-window,
#hs-eu-cookie-confirmation,.termly-styles-root,#axeptio_overlay,#didomi-host,.didomi-popup-open,#qc-cmp2-container,.truste_overlay,
#truste-consent-track,.iubenda-cs-container,#iubenda-cs-banner,.klaro,#klaro,.fc-consent-root,#tarteaucitronRoot,
[id*="cookie" i]:not(html):not(body),[class*="cookie-banner" i],[class*="cookieBanner" i],[class*="cookie-consent" i],[class*="CookieConsent" i],
[id*="consent" i]:not(html):not(body),[class*="consent-banner" i],[aria-label*="cookie" i],[aria-describedby*="cookie" i]
{display:none!important;visibility:hidden!important}
html,body{overflow:auto!important}`;
const ACCEPT = [/^accept all( cookies)?$/i, /^accept( cookies)?$/i, /^allow all( cookies)?$/i, /^allow( cookies)?$/i, /^i accept$/i,
  /^got it!?$/i, /^i agree$/i, /^agree$/i, /^ok(ay)?$/i, /^i understand$/i, /^understood$/i, /^continue$/i];

const frames = [];
for (const [i, url] of urls.entries()) {
  const name = `${String(i).padStart(2, '0')}-${new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '_')}`;
  const ctx = await browser.newContext({
    viewport: { width: opt.width, height: opt.height }, deviceScaleFactor: opt.scale, locale: 'en-US', colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    // Nudge scroll to trigger lazy-loaded media, then return to top
    await page.mouse.wheel(0, 600); await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
    for (const frame of page.frames()) {
      let clicked = false;
      for (const re of ACCEPT) {
        const b = frame.getByRole('button', { name: re }).first();
        if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
      }
      if (clicked) break;
    }
    await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.evaluate(async () => {
      await Promise.all([...document.images].filter(img => !img.complete)
        .map(img => new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 8000); })));
    }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(opt.wait * 1000); // let hero animations / video posters settle
    await page.evaluate(() => window.scrollTo(0, 0));
    const file = join(shotsDir, `${name}.png`);
    await page.screenshot({ path: file, animations: 'allow' });
    frames.push(file);
    console.log(`✓ ${url}`);
  } catch (e) {
    console.error(`✗ ${url}: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}
await browser.close();
if (!frames.length) { console.error('No screenshots captured'); process.exit(1); }

frames.forEach((f, i) => execFileSync('cp', [f, join(work, 'frames', `${String(i).padStart(3, '0')}.png`)]));
const pxW = opt.outWidth || opt.width * opt.scale;
const scale = `scale=${pxW}:-2:flags=lanczos`;
const input = ['-y', '-loglevel', 'error', '-framerate', `1/${opt.duration}`, '-i', join(work, 'frames', '%03d.png')];
if (ext === '.gif') {
  // Per-frame palette + fine ordered dither = sharp text, clean gradients
  execFileSync('ffmpeg', [...input, '-vf',
    `fps=1/${opt.duration},${scale},split[a][b];[a]palettegen=stats_mode=single:max_colors=256[p];[b][p]paletteuse=new=1:dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop', '0', '-final_delay', String(Math.round(opt.duration * 100)), out], { stdio: 'inherit' });
} else {
  // H.264 at near-lossless quality; append the last frame so it gets its full duration
  const last = frames.length;
  execFileSync('cp', [join(work, 'frames', `${String(last - 1).padStart(3, '0')}.png`), join(work, 'frames', `${String(last).padStart(3, '0')}.png`)]);
  execFileSync('ffmpeg', [...input, '-vf', `${scale},fps=${opt.fps},format=yuv420p`, '-t', String(last * opt.duration),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'stillimage', '-movflags', '+faststart',
    ...(ext === '.mov' ? ['-tag:v', 'avc1'] : []), out], { stdio: 'inherit' });
}
if (!opt.shots) rmSync(work, { recursive: true, force: true });
console.log(`\nSaved ${out} (${frames.length} slides × ${opt.duration}s, ${pxW}px wide)`);
