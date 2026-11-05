---
name: og-image-animated
description: "Turn a project's Open Graph share card into a few-second web animation — the brand mark and title drop in from the top, then the real app rises from the bottom and settles into the final card. Builds a playable web route in the project's stack and records it frame by frame into MP4 and GIF (plus the final frame as PNG). Use when asked for an animated OG image, animated share card, social preview video/GIF, or an intro animation of the title and product."
---

# Animated OG image

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Unless the user names another place, save everything it makes in `out/og-image-animated/` under the current project.

The static share card animated as a short, calm reveal:

1. Empty card: background and soft glow only.
2. **Brand mark and title drop in from the top** (fade + slide down).
3. **The app window rises from the bottom** (fade + slide up) and settles exactly where it sits on the static card.
4. Hold on the final frame, which must match the static OG image.

Examples: `references/pulse.gif` (the result) and `references/pulse-frames.png` (four frames: start, title in, app rising, final).

## Rules

- **Start from the static card.** If the project has no OG card component yet, build it first by following `references/static-card.md` (real product, messaging from the current site, realistic data). The animation adds motion only: same markup, same final layout, no new content.
- **One component, two modes.** Add an `animated` prop to the existing card component instead of copying it, so the static PNG and the animation never drift apart. Without the prop, nothing animates.
- **Motion, not effects.** Only `opacity` + `transform: translateY`, one shared ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`). No bounce, blur, scale pops, typewriter text or rotating elements.
- **Short.** Whole timeline about 2–2.5s, then a ~1.5s hold. The title must be fully readable by ~1.3s.
- **CSS animations only** (keyframes + `animation` with `both` fill), no JS-driven tweens or timers inside the card. The recorder seeks CSS animations via the Web Animations API; JS-driven motion would not be captured deterministically.

## Timeline

| Element | Keyframes | Duration | Delay |
|---|---|---|---|
| Brand mark | from `opacity: 0; translateY(-48px)` | 900ms | 100ms |
| Title | from `opacity: 0; translateY(-48px)` | 1000ms | 250ms |
| App window | from `opacity: 0; translateY(320px)` | 1300ms | 700ms |

Tune distances to the card: the app should start mostly below the bottom edge (about half the card height) and the title about its own height above its resting place. If there's a floating panel, let it arrive last (+200ms after the window starts).

## Steps

### 1. Discover

- Find the static card component and its render route (e.g. `og-image.tsx`, `/og/<page>`), and the current PNG in `public/`.
- Note the brand mark, title and app window wrappers. If the window uses `zoom` to fit, animate an **inner** wrapper, not the zoomed element, so offsets stay correct.

### 2. Add the animated mode

In the card component:

```tsx
const KEYFRAMES = `
@keyframes og-drop { from { opacity: 0; transform: translateY(-48px); } to { opacity: 1; transform: none; } }
@keyframes og-rise { from { opacity: 0; transform: translateY(320px); } to { opacity: 1; transform: none; } }
`;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const enter = (name: string, ms: number, delay: number) => ({ animation: `${name} ${ms}ms ${EASE} ${delay}ms both` });

// <div data-og-frame …>{animated && <style>{KEYFRAMES}</style>} …
// brand:  style={animated ? enter('og-drop', 900, 100) : undefined}
// title:  style={animated ? enter('og-drop', 1000, 250) : undefined}
// window: <div style={{ zoom }}><div className="h-full" style={animated ? enter('og-rise', 1300, 700) : undefined}>…
```

Put the keyframes in the component (a `<style>` tag) or the project's global CSS; with Tailwind v4, keyframes inside `@theme` are only emitted when a matching `--animate-*` token is used, so prefer the component or plain CSS.

### 3. Add a web route that plays it

A sibling of the static route, e.g. `/og/<page>-animated` (`noindex`, no app chrome):

- Renders `<Card animated />` inside the 1200×630 frame.
- Replays for previewing: remount the card with a changing `key` every ~4.5s.
- `?loop=0` plays once (the recorder uses this). Normalize the search param to a string first: routers like TanStack parse `?loop=0` as the number `0`, and a missed check keeps remounting the card mid-recording.

Open it in the browser and watch it a few times. Check the entrance order, that nothing flashes before the animation starts, and that the settled state matches the static card.

### 4. Record MP4 + GIF

With the dev server running:

```bash
node <this skill folder>/scripts/record.mjs \
  --url "http://localhost:<port>/og/<page>-animated?loop=0" \
  --out out/og-image-animated/og-<page>
```

Writes `og-<page>.mp4` (2400×1260, H.264, 30fps), `og-<page>.gif` (1200px wide, palette-optimized, loops) and `og-<page>.png` (final frame). How it works: it pauses every animation on the page, reads the timeline length, then seeks all animations frame by frame and screenshots a fixed clip of `[data-og-frame]`. The result is identical on every run, with no dropped frames. Options: `--fps`, `--hold`, `--lead`, `--scale`, `--formats mp4,gif,png`, `--selector`.

Needs `ffmpeg` on PATH. Playwright installs into this skill's `scripts/` folder on the first run, with its Chromium if none is found.

Gotchas:

- The page must not force reduced motion. Many global stylesheets shorten animations under `prefers-reduced-motion`; the recorder doesn't emulate it, and it fails loudly if it finds no animations.
- Element screenshots wait for "stability", which never comes mid-animation. That's why the script clips a page region.
- Make sure the port is really serving this app (another local server can answer on `localhost`).

### 5. Review

Extract a contact sheet and look at it:

```bash
ffmpeg -y -loglevel error -i og-<page>.mp4 \
  -vf "select='eq(n\,8)+eq(n\,22)+eq(n\,40)+eq(n\,<last>)',scale=1000:-1,tile=2x2" -frames:v 1 sheet.png
```

- Frame ~0.25s: empty card (glow only), no layout pop.
- ~0.7s: title in or nearly in, app not yet visible.
- ~1.3s: app mid-rise, title fully readable.
- Last frame: identical in content to the static PNG.

Keep the GIF reasonably small (under ~3MB). If it's bigger, lower `--fps` (20–24) or shorten `--hold`.

## Output

Tell the user:

- the preview route URL (loops) and the files written (MP4, GIF, PNG)
- the regenerate command
- the timeline (what moves, durations)
- that `og:image` must stay the static PNG: social platforms don't play animated OG images. Use the MP4/GIF for posts, README, launch pages or `og:video` where supported.
