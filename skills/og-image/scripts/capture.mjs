#!/usr/bin/env node
// Capture an Open Graph image from a running page.
//
//   node capture.mjs --url http://localhost:3000/og --out out/og-image/og.png
//
// Options (all optional except --url):
//   --selector [data-og-frame]   element to capture (falls back to the viewport)
//   --width 1200 --height 630    CSS size of the card
//   --scale 2                    device pixel ratio (2 → 2400×1260)
//   --wait 2500                  ms to wait after load for fonts, images, entrance animations
//   --hide ".foo, .bar"          extra selectors to hide (dev overlays are hidden by default)
//
// Installs Playwright into this folder on the first run, and its Chromium when none is found.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, token, i, all) => (token.startsWith('--') ? [...pairs, [token.slice(2), all[i + 1]]] : pairs), []),
);

if (!args.url) {
  console.error('Usage: node capture.mjs --url <page> [--out out/og-image/og.png] [--selector ..] [--scale 2] [--wait 2500]');
  process.exit(1);
}

const width = Number(args.width ?? 1200);
const height = Number(args.height ?? 630);
const scale = Number(args.scale ?? 2);
const wait = Number(args.wait ?? 2500);
const selector = args.selector ?? '[data-og-frame]';

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

// Dev-only overlays that must never end up in a share image.
const DEV_OVERLAYS = [
  '.tsqd-parent-container', // TanStack Query devtools
  '.TanStackRouterDevtools', // TanStack Router devtools
  'nextjs-portal', // Next.js dev indicator
  '#__next-build-watcher',
  'vite-error-overlay',
  'astro-dev-toolbar',
  '#webpack-dev-server-client-overlay',
  'section[aria-label^="Notifications"]', // sonner toaster region
];

const { chromium } = loadPlaywright();
const browser = await launchBrowser(chromium);
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
    reducedMotion: 'reduce',
  });
  await page.goto(args.url, { waitUntil: 'networkidle' });
  const hidden = [...DEV_OVERLAYS, ...(args.hide ? [args.hide] : [])].join(', ');
  await page.addStyleTag({ content: `${hidden} { display: none !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(wait);

  const out = resolve(args.out ?? 'out/og-image/og.png');
  const frame = page.locator(selector);
  if ((await frame.count()) > 0) {
    await frame.first().screenshot({ path: out });
  } else {
    console.warn(`No element matches ${selector}; capturing the viewport instead.`);
    await page.screenshot({ path: out });
  }
  console.log(`Saved ${out} (${width * scale}×${height * scale})`);
} finally {
  await browser.close();
}
