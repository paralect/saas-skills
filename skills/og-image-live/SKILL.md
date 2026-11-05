---
name: og-image-live
description: "Make a ~5 second share video (MP4 + GIF) of any project's Open Graph card where the real product comes alive inside the app window — new items arrive and push older ones, statuses change, counters and charts step, grids fill in — while the title and app stay in place. Built as a CSS-animated render route in the project's own stack from its real screens and data shapes, then recorded frame by frame. Use when asked for a live/in-app animated OG image, product-in-motion share video, animated social preview of the app, or a looping product GIF for launch posts."
---

# OG image, live

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Unless the user names another place, save everything it makes in `out/og-image-live/` under the current project.

Output: a **5-second 2400×1260 MP4 and a looping GIF** of the project's share card. The title and the app window are on screen from the first frame, and the **product itself moves in a meaningful way**: the core loop of the app plays out in 2–4 beats, the way a user would see it on a good day.

Example (Pulse, a project activity feed): `references/pulse-live.gif`, `references/pulse-live-frames.png`.

- 0.7s: a commit lands at the top of the feed, and its row opens and pushes the older rows down.
- 2.0s: the task shown earlier as "is working on PLS-42" arrives as "shipped PLS-42 · Done".
- 3.3s: a teammate's update about that fix arrives.
- Meanwhile the activity grid fills week by week, and today's cell deepens as each event lands.

## Rules

1. **Real product, real behavior.** Animate only what the app actually does (items that really stream in, statuses that really change, charts that really update). Build the screen from the real layout, components, tokens and copy, same as a static OG card (see `references/static-card.md`). No invented features, fake metrics, or effects the UI never shows.
2. **Motion tells one story.** Pick the product's core loop and make the beats connect: the same people, ids and objects as the resting state, progressing ("in progress" → "done", "draft" → "published", "3 open" → "2 open"). Secondary visuals (grid, counter, chart, badge) react to the same beats.
3. **Calm and legible.** 2–4 beats, ~1.2–1.4s apart, first beat at ~0.6–0.8s. Every beat ends in a readable state. Only animate `opacity`, `transform`, `grid-template-rows` (height push), `stroke-dashoffset` and background tint. One ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`). No bounce, blur, zoom punches, typewriter text, confetti or camera moves.
4. **Title and chrome never move.** The brand mark, title, window frame, sidebar and header stay static. Motion lives in the content area, and the most important beat happens where the eye already is (top of a list, center of a board).
5. **CSS animations only** (`@keyframes` + `animation: … both`), all mounted at once with delays. No JS timers, state machines or `requestAnimationFrame` inside the card. The recorder pauses and seeks CSS animations via the Web Animations API, which makes the video deterministic.
6. **Exactly ~5s.** Timeline ends ≤ 4.9s; the recorder adds a short hold.

## Pick the moments

Read the primary screen and choose the matching patterns (combine 1 main + 1–2 secondary):

| Product surface | Main beat | Secondary beats |
|---|---|---|
| Feed / inbox / notifications / log | New items arrive at the top and **push** older ones down | unread badge counts up, activity grid/sparkline fills |
| Kanban / pipeline | A card **moves** to the next column (lifts, slides, drops; the gap closes, the destination opens) | column counts step, progress bar grows |
| Chat / comments | Messages arrive one by one, typing indicator before each | reaction chip pops in, unread count steps |
| Table / list with statuses | A row's status chip **crossfades** to the next state, the row briefly tints | summary counter steps, filter count updates |
| Dashboard / analytics | Stat numbers **step** (odometer), bars grow, a line **draws** | delta badge appears, tooltip on the newest point |
| Calendar / scheduling | Events drop into slots | free-time bar shrinks, attendee avatars appear |
| Checklist / onboarding / CI run | Steps check off in order, spinner → check | progress ring fills, "3/5" counter steps |
| Editor / docs | A block or comment appears, a suggestion gets accepted (strike → replace) | collaborator cursor moves along a path, save state flips to "Saved" |

## CSS building blocks

```css
/* Push: wrap an arriving item; older siblings slide down as it opens. */
@keyframes lv-grow  { from { grid-template-rows: 0fr; } to { grid-template-rows: 1fr; } }  /* wrapper: display:grid; child: min-height:0; overflow:hidden */
@keyframes lv-in    { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
@keyframes lv-flash { from { background-color: color-mix(in oklab, var(--accent) 9%, transparent); } to { background-color: transparent; } }

/* Collapse: an item leaving (card moved away, notification dismissed). */
@keyframes lv-shrink { from { grid-template-rows: 1fr; opacity: 1; } to { grid-template-rows: 0fr; opacity: 0; } }

/* Crossfade a status chip / value: stack old + new in one grid cell. */
@keyframes lv-out { to { opacity: 0; transform: translateY(-4px); } }
@keyframes lv-new { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* Fill a cell / pop a badge. */
@keyframes lv-fill { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }

/* Grow a bar (transform-origin: bottom) or a progress bar (origin: left). */
@keyframes lv-bar  { from { transform: scaleY(0); } to { transform: none; } }

/* Draw a line: path with pathLength="1", stroke-dasharray: 1. */
@keyframes lv-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }

/* Counter step (odometer): a column of numbers in an overflow-hidden 1em box, moved with
   steps() or one keyframe stop per beat, e.g. 12 → 13 → 14. */
@keyframes lv-count { 0%, 30% { transform: translateY(0); } 40%, 70% { transform: translateY(-1em); } 80%, 100% { transform: translateY(-2em); } }

/* Move a card between columns: animate an absolutely positioned copy along translate(x, y)
   while the source slot shrinks (lv-shrink) and the destination slot grows (lv-grow). */
```

Timing recipes:

- Arriving item: grow 700ms at `t`, in 600ms at `t+120`, flash 1400ms at `t+120`.
- Grid filling left to right: per cell `delay = 150 + col·240 + row·30`, 380ms each. Only cells with a value get a colored overlay; empty cells stay the base color.
- Reacting visual: step it at `t+250` after the beat it belongs to, **but never before its own reveal**. If a progressive fill hasn't reached that element yet (e.g. today's cell in the last column), show it when the fill arrives at the level of the beats that already happened, then step it for later beats. A lone lit cell in an empty column looks broken.
- Dividers: with height-push lists, put `border-bottom` on every item (not `border-top` on "not first"), so collapsed items never leave double borders.

## Steps

### 1. Discover

- The static OG card: component, render route, PNG. If there isn't one, build it first by following `references/static-card.md`; the live video must end on a state consistent with it.
- The primary screen's real components, and **how the product updates in real life**: sockets or polling that prepend items, status transitions and their labels/colors, counters, charts, today markers.
- Data shapes and vocabulary for the arriving items (ids, statuses, verbs, timestamps like "just now").

### 2. Script the beats

Write the story in 3–5 lines before coding (time → what happens → what reacts), e.g.:

```
0.7s  Igor pushes a checkout fix            → today's cell +1
2.0s  Anastasiya ships PLS-42 (was "in progress") → today's cell +1
3.3s  Dmitry posts an update about the fix   → today's cell +1
0.15–3.5s  activity grid fills week by week
```

Continuity check: every arriving item references something already visible or plausible from the static card.

### 3. Build the live mode

- Add a mode to the existing card component, e.g. `animation?: 'entrance' | 'live'`, instead of copying the card. With no animation, the component renders the unchanged static card.
- In live mode, render every future item in the DOM from the start with its animation delay (collapsed/hidden until its beat). Keep keyframes in a `<style>` tag inside the card, or in plain CSS (Tailwind v4 only emits `@theme` keyframes when an `--animate-*` token uses them).
- Add a route, e.g. `/og/<page>-live` (`noindex`): it renders `<Card animation="live" />` and replays every ~6.5s by remounting with a new `key`. `?loop=0` plays once. Normalize the search param to a string first, because routers like TanStack parse `?loop=0` as the number `0`.
- Make sure the static card is unchanged: capture it again and compare visually.

### 4. Record

```bash
node <this skill folder>/scripts/record.mjs \
  --url "http://localhost:<port>/og/<page>-live?loop=0" \
  --out out/og-image-live/og-<page>-live \
  --lead 0 --hold 200 --formats mp4,gif
```

The script prints the timeline length; set `--hold` so `timeline + hold ≈ 5000`. Output: `<out>.mp4` (2400×1260, H.264, 30fps) and `<out>.gif` (1200px, palette-optimized, loops). Needs `ffmpeg`. Playwright installs into this skill's `scripts/` folder on the first run, with its Chromium if none is found.

Gotchas:

- If the page forces reduced motion (global CSS often does), the recorder finds no animations and fails. Don't emulate reduced motion here.
- Verify the port serves this app. Another local server can answer on `localhost`.
- A dev server started from an agent session dies with it; detach it (`nohup … & disown`) if the user keeps previewing.

### 5. Review

```bash
ffmpeg -y -loglevel error -i <out>.mp4 \
  -vf "select='eq(n\,0)+eq(n\,40)+eq(n\,75)+eq(n\,149)',scale=1000:-1,tile=2x2" -frames:v 1 sheet.png
```

Look at the sheet (and watch the MP4):

- Frame 0: calm resting state, title readable, nothing half-rendered.
- Each beat: the new state is readable for ≥ 0.8s before the next beat starts.
- Pushes are smooth (no jump when an item opens), and nothing overlaps or clips mid-transition.
- Secondary visuals react to beats, not randomly, and nothing appears ahead of its own reveal (check frames from the middle of the fill, not just the four sheet frames).
- Last frame: a coherent "after" state (and close to the static card if that's the brand image).
- GIF under ~3MB. Otherwise lower `--fps` to 24 or trim the timeline.

## Output

Tell the user:

- the files (MP4, GIF) and the looping preview URL
- the beat script (what happens when)
- the regenerate command
- anything shown that isn't from real data (sample names, projects)
- that `og:image` stays the static PNG (platforms don't play animated OG images); use the video for posts, launch pages, README, or `og:video` where supported
