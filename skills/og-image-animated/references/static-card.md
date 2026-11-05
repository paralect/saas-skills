# Build the static share card

Follow this when the project has no OG card component yet. The card is the starting point of the video.

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

