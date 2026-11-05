---
name: website-scroll
description: "Record a top-to-bottom scroll of any web page as a short MP4, the way a reader scrolls it (a flick, a look, another flick) (plus a poster JPEG), with cookie banners, consent dialogs, newsletter popups and chat launchers out of the way, so the page shows as a clean scroll. Use when asked for a scroll video, a scrolling screen recording, a \"scroll of the site/page/landing\", a page walkthrough clip, a preview video of a URL, or a hover video for a link card; also for a tidy full-page still with the popups removed."
---

# Website scroll

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Unless the user names another place, save everything it makes in `out/website-scroll/` under the current project.

Output: a **6–18 second MP4** of a web page scrolled from the top to the bottom the way a reader does it: a flick of about a screen that coasts to a stop, a moment to look, another flick (1440×900 by default, encoded 1280 wide), plus `<out>.jpg`, its first frame, for a poster. Nothing is faked: the real page in a real browser; only the consent dialogs, cookie bars, popups and chat bubbles are taken out.

## How it works

`scripts/scroll.mjs` opens the URL in headless Chrome (the user's own Chrome when there is one, otherwise Playwright's Chromium), waits for the network to settle, then:

1. **Tidies the page.** Hides ~150 known consent managers, cookie bars, chat launchers and promo bars by selector; clicks the accept/close button of any notice that names itself as one; then hides whatever fixed or sticky element still covers the page or sits along an edge and reads like a notice, a dialog that opened on its own, and the scrims behind them. Scroll locks (`overflow: hidden`, `position: fixed` on the body) are undone.
2. **Walks the page once** so lazy images and fonts below the fold load, then returns to the top.
3. **Takes the page's clock**, then captures frame by frame: scroll one step, advance the page's time by exactly one frame, screenshot. Scroll-triggered animations therefore play at the pace a reader would see, however long a screenshot takes, and the take re-renders the same way every time.
4. **Encodes** with ffmpeg (H.264, `+faststart`, plays everywhere).

The take rests at the top (1.2s), then scrolls in flicks: each one shoots off and coasts to a stop about 0.8 of a screen further down (a second or so), rests ~0.7s, and the next follows. Flick lengths and rests vary a little, from a seeded generator, so it reads as a hand on a trackpad and still records the same way every time; the last flick lands on the bottom, where the take rests 1.5s. A page longer than the time budget (18s) gets shorter rests, then brisker flicks, to fit; past 12,000 px it stops.

## Usage

```bash
node <this skill folder>/scripts/scroll.mjs --url https://example.com/pricing --out out/website-scroll/pricing
```

Writes `out/website-scroll/pricing.mp4` and `out/website-scroll/pricing.jpg`. Options:

| Option                | Default   | What it does                                                                                  |
| --------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `--width`, `--height` | 1440, 900 | Viewport in CSS px; this is the video's aspect ratio. `--width 390 --height 844` for a phone. |
| `--scale`             | 1         | Device pixels per CSS px. 2 for crisp text at the cost of time.                               |
| `--fps`               | 30        | Frames per second.                                                                            |
| `--page`              | 0.8       | How far each flick goes, as a share of the viewport height. Less for dense pages (0.6).      |
| `--pause`             | 0.7       | Seconds resting between flicks. Longer for text-heavy pages (1), shorter for galleries (0.4). |
| `--hold`, `--tail`    | 1.2, 1.5  | Seconds resting at the top and at the bottom.                                                 |
| `--max`               | 18        | Longest video in seconds; a long page scrolls faster to fit.                                  |
| `--max-scroll`        | 12000     | Farthest to scroll, in px.                                                                    |
| `--out-width`         | 1280      | Width of the encoded MP4.                                                                     |
| `--dark`              | off       | Prefer the page's dark color scheme.                                                          |
| `--still`             | off       | One JPEG of the tidied page instead of a video, for a quick check.                            |
| `--keep-frames`       | off       | Leave the captured frames next to the output.                                                 |

Needs `ffmpeg` on PATH (`brew install ffmpeg`). Playwright installs into this skill's `scripts/` folder on the first run, with its Chromium if none is found; your own Chrome is used when you have one.

## Rules

1. **Check the still first when the site is unfamiliar** (`--still`). If a banner is still in the picture, add its selector to `NOISE_SELECTORS` in the script or a phrase to `NOISE_TEXT`; don't hand-edit frames.
2. **Public pages only, as a visitor sees them.** The recorder signs in to nothing and keeps no cookies; a page behind a login shows its login screen. For the running app behind sign-in, use the `video-demo` skill.
3. **One page per video.** A launch post with three links gets three recordings, one per link, named after the page (`out/website-scroll/<slug>.mp4`).
4. **Don't fight the page's own motion.** Marquees, hero videos and scroll animations are part of the page and play in the recording; only overlays are removed.
5. **Keep it short.** The defaults land most pages at 6–12 seconds. If a page is very long, let the time budget shorten the rests rather than raising `--max` far past 18s; a hover preview is not a tour.
