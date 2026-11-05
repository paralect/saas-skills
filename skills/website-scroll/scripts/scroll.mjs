#!/usr/bin/env node
// Record a top-to-bottom scroll of a web page as a short MP4, the way a reader would
// scroll it (a flick of about a screen, a pause to look, another flick), with the cookie
// banners, consent dialogs, newsletter popups and chat launchers out of the way.
//
//   node scroll.mjs --url https://example.com --out out/website-scroll/example
//
// Writes <out>.mp4 and <out>.jpg (the first frame, for a poster). Frames are captured one
// by one (the page is scrolled by script and its clock advanced by exactly one frame each
// time), so scroll-triggered animations land where they would for a reader and the take
// re-renders the same way every time. Needs playwright-core (+ Chrome or Chromium) and
// ffmpeg on PATH.
//
// Options:
//   --width 1440 --height 900   viewport in CSS px; this is the video's aspect ratio
//   --scale 1                   device pixels per CSS px for the frames (2 for crisp text, slower)
//   --fps 30                    frames per second
//   --page 0.8                  how far each flick goes, as a share of the viewport height
//   --pause 0.7                 seconds resting between flicks, to look at what came in
//   --hold 1.2                  seconds resting at the top before the scroll starts
//   --tail 1.5                  seconds resting at the bottom
//   --max 18                    longest video in seconds; a long page scrolls faster to fit
//   --max-scroll 12000          how far down to go at most, in CSS px
//   --out-width 1280            width of the encoded MP4 (height follows the aspect)
//   --dark                      prefer the page's dark color scheme
//   --keep-frames               write the frames next to the output (<out>.frames/) and leave them
//   --still                     one JPEG of the prepared page (banners hidden), no video
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, token, i, all) => {
    if (!token.startsWith("--")) return pairs;
    const next = all[i + 1];
    const value = next === undefined || next.startsWith("--") ? "true" : next;
    return [...pairs, [token.slice(2), value]];
  }, []),
);

if (!args.url) {
  console.error(
    "Usage: node scroll.mjs --url <https://…> [--out out/website-scroll/<page>] [--width 1440 --height 900]",
  );
  process.exit(1);
}

const URL_ = args.url;
const WIDTH = Number(args.width ?? 1440);
const HEIGHT = Number(args.height ?? 900);
const SCALE = Number(args.scale ?? 1);
const FPS = Number(args.fps ?? 30);
const PAGE = Number(args.page ?? 0.8);
const PAUSE = Number(args.pause ?? 0.7);
const HOLD = Number(args.hold ?? 1.2);
const TAIL = Number(args.tail ?? 1.5);
const MAX = Number(args.max ?? 18);
const MAX_SCROLL = Number(args["max-scroll"] ?? 12000);
const OUT_WIDTH = Number(args["out-width"] ?? 1280);
const DARK = args.dark === "true";
const KEEP = args["keep-frames"] === "true";
const STILL = args.still === "true";
// Named after the page unless --out says otherwise: example.com/pricing -> example-com-pricing
const pageName = args.url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const out = resolve((args.out ?? `out/website-scroll/${pageName}`).replace(/\.(mp4|jpg|jpeg|png)$/, ""));

// ---- dependencies ------------------------------------------------------------

// Playwright lives in this skill's own folder: installed next to this script on the first run,
// never looked up in the project, the npx cache or anywhere else.
const HERE = dirname(fileURLToPath(import.meta.url));

function loadPlaywright() {
  const path = join(HERE, "node_modules", "playwright");
  if (!existsSync(path)) {
    console.error("Installing Playwright into this skill's folder (first run)...");
    execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund"], { cwd: HERE, stdio: ["ignore", 2, 2] });
  }
  return createRequire(import.meta.url)(path);
}

// Downloads Playwright's Chromium the first time a launch can't find one.
async function launchBrowser(chromium, options = {}) {
  try {
    return await chromium.launch(options);
  } catch {
    execFileSync(join(HERE, "node_modules", ".bin", "playwright"), ["install", "chromium"], { stdio: ["ignore", 2, 2] });
    return chromium.launch(options);
  }
}

if (!STILL) {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("ffmpeg not found on PATH (brew install ffmpeg).");
    process.exit(1);
  }
}

import { TIDY_CSS, tidyOptions, tidyPage } from "./page-tidy.js";

// ---- browser -----------------------------------------------------------------

mkdirSync(dirname(out), { recursive: true });
let framesDir;
if (KEEP) {
  framesDir = `${out}.frames`;
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
} else {
  framesDir = mkdtempSync(join(tmpdir(), "website-scroll-"));
}

const { chromium } = loadPlaywright();
const launchArgs = [
  "--hide-scrollbars",
  "--disable-blink-features=AutomationControlled",
];
// The user's Chrome when there is one, so nothing has to be downloaded.
const browser = await chromium
  .launch({ channel: "chrome", headless: true, args: launchArgs })
  .catch(() => launchBrowser(chromium, { headless: true, args: launchArgs }));
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: SCALE,
  colorScheme: DARK ? "dark" : "light",
  reducedMotion: "no-preference",
  locale: "en-US",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
});
const page = await ctx.newPage();

const frameMs = 1000 / FPS;

// ---- the motion ----------------------------------------------------------------

/**
 * A reader doesn't scroll at one speed: they flick the trackpad, the page
 * shoots off and coasts to a stop about a screen further down, they look, and
 * flick again. Each flick here is that: a quick start that decays like
 * momentum, then a rest. Flick lengths and rests vary a little, from a seeded
 * generator so the same page records the same way every time. The last flick
 * lands exactly at the bottom.
 */
function planFlicks(distance) {
  if (distance <= 0) return [];
  let seed = 0x9e3779b9;
  const rand = () => {
    // xorshift32: enough variety for a handful of flicks, and repeatable.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 10000) / 10000;
  };
  const vary = (value, spread) => value * (1 + (rand() * 2 - 1) * spread);

  // Cut the distance into flicks of about a screen each, none tiny.
  const typical = Math.max(200, HEIGHT * PAGE);
  const count = Math.max(1, Math.round(distance / typical));
  const lengths = Array.from({ length: count }, () => vary(1, 0.25));
  const scale = distance / lengths.reduce((sum, w) => sum + w, 0);
  const flicks = lengths.map((w) => ({ length: w * scale }));

  // A flick takes longer the further it goes (a bigger push coasts longer);
  // the rest after it is about the same each time, give or take.
  let travel = 0;
  let rest = 0;
  for (const flick of flicks) {
    flick.seconds = Math.min(1.5, 0.6 + (flick.length / HEIGHT) * 0.55);
    flick.pause = Math.max(0.15, vary(PAUSE, 0.35));
    travel += flick.seconds;
    rest += flick.pause;
  }
  flicks[flicks.length - 1].pause = 0; // the tail rests at the bottom

  // A long page has to fit the time budget: shorten the rests first, then the
  // flicks themselves, so the motion keeps its shape and only gets brisker.
  const budget = Math.max(2, MAX - HOLD - TAIL);
  if (travel + rest > budget) {
    const restBudget = Math.max(0, budget - travel);
    const restScale = rest > 0 ? Math.min(1, restBudget / rest) : 1;
    for (const flick of flicks) flick.pause *= restScale;
    rest *= restScale;
    if (travel + rest > budget) {
      const travelScale = Math.max(0.35, (budget - rest) / travel);
      for (const flick of flicks) flick.seconds *= travelScale;
    }
  }

  // Momentum: fast off the mark, then coasting to a stop.
  const ease = (t) => 1 - Math.pow(1 - t, 2.6);
  let at = 0;
  let from = 0;
  return flicks.map((flick) => {
    const frames = Math.max(2, Math.round(flick.seconds * FPS));
    const pauseFrames = Math.round(flick.pause * FPS);
    const planned = {
      from,
      length: flick.length,
      start: at,
      frames,
      end: at + frames + pauseFrames,
      ease,
    };
    from += flick.length;
    at = planned.end;
    return planned;
  });
}

try {
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
  await page
    .waitForLoadState("networkidle", { timeout: 12_000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  // Fonts and lazy images: walk the page once so everything below the fold has
  // loaded before the take, then come back up.
  await page.addStyleTag({ content: TIDY_CSS });
  const tidy = () =>
    page.evaluate(tidyPage, tidyOptions({ width: WIDTH, height: HEIGHT }));
  await tidy();
  await page.waitForTimeout(600);
  await tidy();

  const total = await page.evaluate(async (max) => {
    const doc = document.documentElement;
    const height = () =>
      Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
    const step = Math.max(300, window.innerHeight * 0.8);
    for (let y = 0; y < Math.min(height(), max) + step; y += step) {
      window.scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 60));
    }
    await document.fonts?.ready;
    const images = [...document.images].filter((img) => !img.complete);
    await Promise.race([
      Promise.all(
        images.map(
          (img) => new Promise((done) => (img.onload = img.onerror = done)),
        ),
      ),
      new Promise((done) => setTimeout(done, 2500)),
    ]);
    window.scrollTo(0, 0);
    return height();
  }, MAX_SCROLL);
  await page.waitForTimeout(500);
  await tidy();
  await page.evaluate(() => window.scrollTo(0, 0));

  if (STILL) {
    await page.screenshot({ path: `${out}.jpg`, type: "jpeg", quality: 90 });
    console.log(`${out}.jpg`);
    await browser.close();
    process.exit(0);
  }

  // ---- the take ----------------------------------------------------------------

  const distance = Math.max(0, Math.min(total, MAX_SCROLL) - HEIGHT);
  const plan = planFlicks(distance);
  const holdFrames = Math.round(HOLD * FPS);
  const tailFrames = Math.round(TAIL * FPS);
  const scrollFrames = plan.length > 0 ? plan[plan.length - 1].end : 0;
  const frames = holdFrames + scrollFrames + tailFrames;
  /** Where the page sits at frame `i` of the scroll: on a flick, or resting after one. */
  const positionAt = (i) => {
    let y = 0;
    for (const flick of plan) {
      if (i < flick.start) break;
      const t = Math.min(1, (i - flick.start + 1) / flick.frames);
      y = flick.from + flick.length * flick.ease(t);
    }
    return Math.round(y);
  };

  // From here on the page's clock is the recorder's: it is frozen, and each
  // frame moves it on by exactly one frame, so scroll-triggered animations
  // play at their intended pace no matter how long a screenshot takes. The
  // clock is only taken over now, after the page has loaded on real time.
  let clocked = false;
  {
    try {
      await page.clock.install();
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(now + 100);
      clocked = true;
    } catch {
      // Older Playwright: real time it is.
    }
  }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Animation.enable").catch(() => {});

  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    let y = 0;
    if (i >= holdFrames && i < holdFrames + scrollFrames) {
      y = positionAt(i - holdFrames);
    } else if (i >= holdFrames + scrollFrames) {
      y = distance;
    }
    await page.evaluate((top) => window.scrollTo(0, top), y);
    if (clocked) await page.clock.runFor(frameMs);
    else await page.waitForTimeout(Math.max(0, frameMs - 40));
    await page.screenshot({
      path: join(framesDir, `frame${String(i).padStart(5, "0")}.jpg`),
      type: "jpeg",
      quality: 88,
    });
    if (i === 0) copyFileSync(join(framesDir, "frame00000.jpg"), `${out}.jpg`);
  }
  await browser.close();
  const took = ((Date.now() - started) / 1000).toFixed(1);

  // ---- encode ------------------------------------------------------------------

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(FPS),
      "-i",
      join(framesDir, "frame%05d.jpg"),
      "-vf",
      `scale=${OUT_WIDTH}:-2:flags=lanczos`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      `${out}.mp4`,
    ],
    { stdio: "inherit" },
  );
  if (!KEEP) rmSync(framesDir, { recursive: true, force: true });
  console.log(
    `${out}.mp4 (${(frames / FPS).toFixed(1)}s, ${frames} frames captured in ${took}s, scrolled ${distance}px of ${total}px)`,
  );
} catch (error) {
  await browser.close().catch(() => {});
  if (!KEEP) rmSync(framesDir, { recursive: true, force: true });
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
