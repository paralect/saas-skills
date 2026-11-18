# Release header images

Every release note opens with a picture of the part of the product it's about: the product's real interface, cropped to the screen where the change lives, with the changed piece lifted out and enlarged. One image per note, the same composition for every note, so the changelog reads as a set. The image sits right above the note's title, so it carries no words of its own: no headline, no logo lockup, no "New!" badge.

This works on any project with a UI. For a project without one (a CLI, an API), skip the image unless the user asks, and say so in the summary.

## Size and file

- 1200×630 CSS pixels, captured at 2x (2400×1260 PNG). The same size is a share card, so the image doubles as the release's link preview.
- Captured to `out/write-changelog/<slug>/cover.png`, then either uploaded to the project's CDN or copied to `<static>/changelog/<slug>/cover.png`, where `<static>` is the `public/` or `static/` folder of the app that publishes the changelog. SKILL.md, "Where the images go", says which.
- The note's frontmatter points at it with the key the folder already uses for covers (`coverImage`, `imageUrl`, `image` or `cover`; `coverImage` if none): the CDN URL, or the site path `/changelog/<slug>/cover.png`.

## The composition

Build it from the product, never from invented UI. Read the project's design tokens (Tailwind theme, CSS variables), fonts and icon set first, and use them as they are.

1. **The stage.** The product's own muted surface as the background (its sidebar or muted color, not pure white), a faint grid fading toward the edges, and one soft blurred glow in the product's accent color behind the windows. Nothing else.
2. **The base window.** The screen where the change lives, in the product's chrome: the app's sidebar and header for an app screen, a browser frame with the address in the bar for a published page, window buttons for a desktop app. It's anchored at the same inset on every image (80px from the left and top) and runs off the bottom edge. It gets a light shadow and a hairline ring.
3. **The piece in focus.** The one thing the release is about: the new menu, dialog, setting, card, panel or state. Lift it above the base window with a stronger shadow, overlapping it, and enlarge it 1.05 to 1.25 times when it's small. Keep its right edge at the same 80px inset as the base's left edge. One focal piece per image; if the note has three features, show the one in its title.

Rules for what's inside:

- Only what the product really has: its labels, statuses, icons and screens exactly as they appear. Show the state the note describes (the new setting selected, the failed task, the published link).
- Demo data shaped like real data: believable names, dates, counts. Never a real user's email, tokens, private messages or customer data.
- Secondary text as the product's skeleton bars, so a stray paragraph never competes with the focal piece.
- The product's current name, logo and tabs, even on images for old releases: nothing stale that was renamed since.

## Sources, best first

1. **Real screenshots.** Run the app and capture the screen (sign in the way the project's screenshot notes say; use a demo account or seed data), or capture a published page. Put the screenshot inside the base window or a browser frame and crop to the relevant part. Screenshots of published sites are fair game without signing in.
2. **The product's own components**, rendered with static demo props: when the screen needs a state that's hard to reach, or the app can't run here. Import them if they're presentational; copy the markup and classes into a demo component if they're tied to data.
3. **Demo components that already exist** in the project's marketing site (a hero or feature-card mockup built from the app's markup) are made for this; reuse them.

## How to build and capture

Make it a page in the project's own stack, so the images can be re-rendered when the UI changes:

- **A render route** in the marketing site (or, failing that, the app), e.g. `/cover/<slug>`, marked `noindex` and linked from nowhere. One scene component per release in a map keyed by slug, built from shared pieces: the stage, the app window, the browser window, and a layer placed by its top-left corner with an optional scale. Real screenshots it uses live next to the scenes (e.g. `covers/shots/`).
- **No frontend stack at all**: one self-contained HTML file per image with Tailwind from the CDN, the screenshots embedded as images.

Capture with `scripts/capture.mjs` in this skill's folder, with the dev server running:

```
node <this skill folder>/scripts/capture.mjs --url http://localhost:3000/cover/<slug> \
  --selector '#cover' --width 1200 --height 630 --scale 2 \
  --out out/write-changelog/<slug>/cover.png
```

The same script takes the source screenshots: point it at a page with no matching selector and `--width 1440 --height 900` (or a phone's 393×852) and it captures the viewport. When the project already has Playwright, a small script of its own that renders every slug in one go is better (add it as a `covers` script in `package.json`), so the whole set is one command later.

## Check every image

Open each PNG and look at it before you finish:

- Text is crisp and legible at the size the changelog shows it (about 800px wide).
- Nothing is clipped except the base window's bottom edge; the left and right insets match, and match the other images.
- The focal piece is what the note's title names.
- No old product names, stale tabs or real personal data.

Then list the images in your reply, as URLs or paths relative to the project root, and say how to re-render them.
