#!/usr/bin/env node
// Capture an Open Graph image from a running page.
//
//   node capture.mjs --url http://localhost:3000/og --out public/og.png
//
// Options (all optional except --url and --out):
//   --selector [data-og-frame]   element to capture (falls back to the viewport)
//   --width 1200 --height 630    CSS size of the card
//   --scale 2                    device pixel ratio (2 → 2400×1260)
//   --wait 2500                  ms to wait after load for fonts, images, entrance animations
//   --hide ".foo, .bar"          extra selectors to hide (dev overlays are hidden by default)
//
// Needs playwright-core + a Chromium build. Resolution order: the project's node_modules,
// PLAYWRIGHT_CORE env var (path to the package), any copy cached by `npx`. If none is found,
// run `npx -y playwright@latest install chromium` once and retry.
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, token, i, all) => (token.startsWith('--') ? [...pairs, [token.slice(2), all[i + 1]]] : pairs), []),
);

if (!args.url || !args.out) {
  console.error('Usage: node capture.mjs --url <page> --out <file.png> [--selector ..] [--scale 2] [--wait 2500]');
  process.exit(1);
}

const width = Number(args.width ?? 1200);
const height = Number(args.height ?? 630);
const scale = Number(args.scale ?? 2);
const wait = Number(args.wait ?? 2500);
const selector = args.selector ?? '[data-og-frame]';

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
const browser = await chromium.launch();
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

  const out = resolve(args.out);
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
