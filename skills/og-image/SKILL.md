---
name: og-image
description: "Generate an Open Graph / social share image (og:image, Twitter card) for the current project — a short title pitch over the product's real interface, built in the project's own stack from its real layout, components, tokens and copy, captured at 2x as a PNG and wired into the page meta tags. Use when asked for an OG image, social preview, share card, link preview image, or twitter:image."
---

# OG image

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Unless the user names another place, save everything it makes in `out/og-image/` under the current project.

A share card sells the product in the half second someone scrolls past a link. The formula: **brand mark, one short title, and the real product underneath**, cropped by the bottom edge. Nothing else.

Reference style (see `references/`):

- `control-panel.png` — brand mark centered on top, a very large one-line title, then the app window (sidebar, header, list) starting at about a third of the height, bleeding off the bottom, with one floating detail panel on the right.
- `pulse.png` — same composition built from Pulse's real layout: sidebar with project icons, search header, project page with tabs, feed rows and the activity rail.

## Rules

1. **Real product, never made up.** Show the app as it ships today. Only use screens, tabs, labels, statuses and features that exist in the code. No invented metrics, charts or features, even if the landing page copy talks about them. If a marketing demo on the site shows something the app doesn't have, don't copy that demo.
2. **Messaging comes from the current site.** Take the pitch and the sample content from the live homepage (its hero, its demo data) unless the user gives a title. If the user gives a title, use it verbatim (a trailing period is fine for a statement headline; ask if unsure).
3. **Looks alive, not generated.** Demo data must read like a real team's week:
   - Real-looking people with the project's own avatar photos if it ships any (e.g. `public/landing/people`); use the names the user asks for.
   - Entities get icons or images, not bare letters (e.g. project avatars as colored icon tiles tinted with the product's theme accents).
   - Activity grids, charts and counts follow real rhythms: busy Mon–Fri with variation, mostly empty weekends with the odd light day, the current week cut off at today, month labels where months actually start. Never a uniform or obviously repeating pattern.
   - Relative times, IDs, branches and statuses in the formats the app uses.
4. **Copy leads.** The title is the biggest, darkest thing on the card and readable at thumbnail size (~60–72px on a 1200px card, one line, tight tracking, the product's display font). The product sits below it and never overlaps it.
5. **Product's own style only.** Background, fonts, colors, radii, shadows from the project's tokens. A very soft accent-tinted glow behind the title is fine; no new palettes, gradients or stock art.

## Steps

### 1. Discover

- Read the homepage/landing component and README for the pitch, product name and sample content.
- Find the real app shell (layout, sidebar, header) and the primary screen (routes + components). Note exact class names, text sizes, tab labels, status chip tones, empty/loading states you must avoid.
- Find tokens (global CSS / theme), fonts, icon library, brand mark component, avatar assets.
- Check what's already there: an existing OG route/image, `og:image` meta in the root or page head, `WEB_URL`/site URL config.

### 2. Build a render route

Build the card as a real page in the project's stack so it uses the actual fonts, tokens and components (not a hand-drawn SVG, not a screenshot of prod with private data):

- One route, e.g. `/og/<page>` (TanStack `routes/og.<page>.tsx`, Next `app/og/<page>/page.tsx`, etc.), `noindex`, no app chrome.
- One component (e.g. `og-image.tsx` next to the landing it belongs to) rendering a fixed **1200×630** frame with `data-og-frame` on the root and `overflow-hidden`.
- Layout:
  - Brand mark centered, ~48px from the top.
  - Title centered under it.
  - App window starting ~200–240px from the top, ~60px from the left, wider than the remaining space so it bleeds off the right or bottom edge. Rounded top corners, hairline border, the product's shadow.
- Inside the window, rebuild the real screen as a static replica: shell (sidebar + header) plus the primary screen. Copy markup and classes from the real components; cite the source files in a header comment. Static props only, no queries, no timers.
- To fit a full-size layout into the card, lay the window out at its natural width (e.g. 1200px) and shrink it with `zoom` (0.85–0.95). `zoom` also scales `top`/`left` on the same element, so divide the intended offsets by the zoom factor.
- Reuse existing demo primitives from the landing (avatars, source badges, heat colors) when they match the real app.

### 3. Capture

Start the dev server (or reuse one), then:

```bash
node <this skill folder>/scripts/capture.mjs \
  --url http://localhost:<port>/og/<page> \
  --out out/og-image/og-<page>.png
```

It opens a 1200×630 viewport at 2x (→ **2400×1260**), prefers reduced motion, hides dev overlays (TanStack/Next/Vite/Astro devtools, toasters), waits for fonts, and screenshots `[data-og-frame]`. Use `--hide` for any other overlay and `--wait` if images load slowly.

Gotchas:

- **Port collisions:** check the port is really serving this app (`lsof -iTCP:<port> -sTCP:LISTEN`, and look at the page title). Another local app on `[::1]:<port>` can silently answer `localhost`. Pick a free port if needed.
- A background dev server started from an agent session dies with the session. Detach it (`nohup … & disown`) if the user needs to keep previewing.
- Don't hide overlays with broad `:has()` / `body > div` rules; they can hide the app root and time out the capture.

### 4. Look at it

Open the PNG and check it like a designer, at full size and imagining it at 500px wide:

- Title on one line, nothing overlapping it, generous space above the window.
- No devtools badges, cursors, toasts, loading skeletons, or half-played animations.
- Nothing clipped awkwardly (a label cut mid-word at a side edge, a chip half hidden). Bottom/right bleed is intended; left and top edges of the window are fully visible.
- Data looks real (rule 3). Iterate until it does, then copy the final PNG into `public/`.

### 5. Wire the meta tags

On the page the image belongs to (or the root for a site-wide card):

- `og:type`, `og:title`, `og:description`
- `og:image` — **absolute URL**, built from the site URL config (e.g. `${WEB_URL}/og-<page>.png`)
- `og:image:width` 2400, `og:image:height` 1260, `og:image:alt` describing title + what the product shot shows
- `twitter:card` = `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`

Verify the tags appear in the served HTML (`curl -s <page> | grep og:image`) and the PNG URL returns `200 image/png`.

## Output

Tell the user:

- where the PNG and the render route/component live
- how to regenerate: the capture command above
- what the image shows and which real screens/components it replicates
- anything that isn't from real data (sample names, projects), and that the site URL env must point at the production domain for crawlers to resolve the image
