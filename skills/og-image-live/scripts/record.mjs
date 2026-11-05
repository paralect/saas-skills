#!/usr/bin/env node
// Record a CSS-animated share card (entrance or in-app live animation) frame by frame and encode MP4 + GIF (+ the final frame as PNG).
//
//   node record.mjs --url "http://localhost:3000/og/home-animated?loop=0" --out public/og-home
//
// Writes <out>.mp4, <out>.gif and <out>.png (last frame, same as the static card).
//
// Options:
//   --selector [data-og-frame]   element to record (falls back to the viewport)
//   --width 1200 --height 630    CSS size of the card
//   --scale 2                    pixel ratio for frames / MP4 (GIF is always encoded at 1x width)
//   --fps 30                     frames per second (GIF uses min(fps, 25))
//   --hold 1500                  ms to hold the final frame at the end
//   --lead 200                   ms of the first frame before the timeline starts
//   --formats mp4,gif,png        which outputs to write
//
// Deterministic: every CSS animation / transition on the page is paused and seeked to each
// frame's time via the Web Animations API, so frames never drop and the result is identical on
// every run. Needs playwright-core (+ Chromium) and ffmpeg on PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, token, i, all) => (token.startsWith('--') ? [...pairs, [token.slice(2), all[i + 1]]] : pairs), []),
);

if (!args.url || !args.out) {
  console.error('Usage: node record.mjs --url <page?loop=0> --out <path/without-extension> [--fps 30] [--hold 1500]');
  process.exit(1);
}

const width = Number(args.width ?? 1200);
const height = Number(args.height ?? 630);
const scale = Number(args.scale ?? 2);
const fps = Number(args.fps ?? 30);
const hold = Number(args.hold ?? 1500);
const lead = Number(args.lead ?? 200);
const selector = args.selector ?? '[data-og-frame]';
const formats = new Set((args.formats ?? 'mp4,gif,png').split(','));
const out = resolve(args.out.replace(/\.(mp4|gif|png)$/, ''));

function loadPlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_CORE) {
    candidates.push(process.env.PLAYWRIGHT_CORE);
  }
  candidates.push(join(process.cwd(), 'node_modules', 'playwright-core'));
  candidates.push(join(process.cwd(), 'node_modules', 'playwright'));
  const npxCache = join(homedir(), '.npm', '_npx');
  if (existsSync(npxCache)) {
    for (const dir of readdirSync(npxCache)) {
      candidates.push(join(npxCache, dir, 'node_modules', 'playwright-core'));
    }
  }
  const require = createRequire(import.meta.url);
  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }
    try {
      const pw = require(path);
      if (pw.chromium) {
        return pw;
      }
    } catch {
      // try the next one
    }
  }
  throw new Error('playwright-core not found. Run `npx -y playwright@latest install chromium` and retry.');
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  if (formats.has('mp4') || formats.has('gif')) {
    throw new Error('ffmpeg not found on PATH (macOS: `brew install ffmpeg`).');
  }
}

const DEV_OVERLAYS = [
  '.tsqd-parent-container',
  '.TanStackRouterDevtools',
  'nextjs-portal',
  '#__next-build-watcher',
  'vite-error-overlay',
  'astro-dev-toolbar',
  '#webpack-dev-server-client-overlay',
  'section[aria-label^="Notifications"]',
];

const frames = mkdtempSync(join(tmpdir(), 'og-anim-'));
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto(args.url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: `${DEV_OVERLAYS.join(', ')} { display: none !important; }` });
  await page.evaluate(() => document.fonts.ready);

  // Pause everything and measure the timeline (latest delay + duration across animations).
  const total = await page.evaluate(() => {
    const animations = document.getAnimations();
    let end = 0;
    for (const a of animations) {
      a.pause();
      const t = a.effect?.getComputedTiming();
      if (t && Number.isFinite(t.endTime)) {
        end = Math.max(end, Number(t.endTime));
      }
    }
    return { end, count: animations.length };
  });
  if (total.count === 0) {
    throw new Error('No CSS animations found on the page. Is the animated variant rendered (and not reduced-motion)?');
  }

  // Clip a fixed page region instead of an element screenshot: element screenshots wait for
  // "stability", which never comes while the page is mid-animation.
  const frame = page.locator(selector);
  const box = (await frame.count()) > 0 ? await frame.first().boundingBox() : null;
  const clip = box ?? { x: 0, y: 0, width, height };
  const duration = lead + total.end + hold;
  const count = Math.ceil((duration / 1000) * fps);
  console.log(`Timeline ${Math.round(total.end)}ms, ${total.count} animations → ${count} frames @ ${fps}fps`);

  for (let i = 0; i < count; i++) {
    const t = Math.min(Math.max(0, (i / fps) * 1000 - lead), total.end);
    await page.evaluate((time) => {
      for (const a of document.getAnimations()) {
        a.currentTime = time;
      }
    }, t);
    await page.screenshot({ path: join(frames, `f${String(i).padStart(5, '0')}.png`), clip, animations: 'allow' });
  }

  const pattern = join(frames, 'f%05d.png');
  if (formats.has('png')) {
    execFileSync('cp', [join(frames, `f${String(count - 1).padStart(5, '0')}.png`), `${out}.png`]);
    console.log(`Saved ${out}.png`);
  }
  if (formats.has('mp4')) {
    execFileSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', `${out}.mp4`],
    );
    console.log(`Saved ${out}.mp4`);
  }
  if (formats.has('gif')) {
    const gifFps = Math.min(fps, 25);
    const filters = `fps=${gifFps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', pattern, '-vf', filters, '-loop', '0', `${out}.gif`]);
    console.log(`Saved ${out}.gif`);
  }
} finally {
  await browser.close();
  rmSync(frames, { recursive: true, force: true });
}
