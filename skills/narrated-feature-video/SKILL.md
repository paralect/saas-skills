---
name: narrated-feature-video
description: Use when making release-note or changelog videos of a real web app's new features (a screen recording of the actual UI with a drawn cursor and a voiceover), e.g. "do videos for the sprint changelog", "record the new feature with voice", "same format as before, same voice". Also for Kokoro TTS narration timed to a recording, and for fixing a take whose cursor jumps, teleports or looks cut.
---

# Narrated feature video

A 25-60 s MP4 per feature: the real app driven by a scripted, hand-like cursor, recorded at 2520x1080, with a calm
local TTS voice (Kokoro `af_sky`) saying one short line per beat. Not this skill: motion-graphics explainers, framed
square social clips without a voice.

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder.
It needs nothing from other skills or other folders, so don't go looking for them. The kit is `scripts/` (call it
`KIT`); every script says how to run it in its header. Run takes from a work dir with `npm i playwright-core`, and
point them at the kit with `NFV_KIT=$KIT/rec.mjs`. Needs Node, `ffmpeg`, Google Chrome and Python 3.10-3.12 for the
voice. Unless the user names another place, the finished videos go to `out/narrated-feature-video/` in the current
project.

| File | What it does |
|---|---|
| `rec.mjs` | `Recorder` (screencast to MP4, `mark()` beats, `pause()`/`resume()` for cuts), `human()` cursor, `CURSOR_SCRIPT` (stays above modal dialogs), `MASK_SCRIPT` (blur, hide, css), `rewrite()`/`json()` for mocks, `settle()` |
| `take-example.mjs` | A complete, runnable take. Copy it, keep its skeleton, replace CONFIG and SCENES |
| `check-video.sh` | The review gate: sudden changes, a full-size frame after each, the marks on the video clock, cursor teleports, a 1 frame/s sheet |
| `setup-kokoro.sh` | One-time Kokoro install to `~/.cache/kokoro` |
| `voiceover.py` | Timed lines to WAV; refuses overlapping lines |
| `mux.sh` | Video + voice to the final MP4 (-18 LUFS) |
| `scripts/servgrow_example.md` | An example of a product's notes (places, sign-in, privacy rules, lessons per area). Read the product's own notes file when one exists; copy this one to start one |
| `take-hoppscotch-request.mjs`, `take-mermaid-live-edit.mjs`, `take-excalidraw-sketch.mjs` | Three finished takes on public apps, each with its `lines-<name>.json`: typing and sending, editing code with a live preview, drawing on a canvas with drags |

## Workflow

1. **Scope.** Which features, in what order. If the product has a notes file (`<product>.md` next to the takes, copied from `scripts/servgrow_example.md`), read it. If the user hasn't picked the
   headline features and is around to answer, offer the candidates and let them pick. If they said not to ask, pick
   yourself and say what you picked.
2. **Storyboard per video, in one line per beat:** what's on screen → the action → the sentence that will be spoken.
   4-8 beats, 25-60 s. Show the feature being used, not a tour of settings. Point at irreversible or paid actions
   (Pay, Charge, Send, "Add to my plan", play an AI voice) instead of clicking them.
3. **Data.** Look at the real screens first: copy `take-example.mjs`, rough in the beats with a mark at each screen
   (just navigation and clicks, no polish yet), and run it with `NFV_PROBE=1`. Nothing is recorded; each mark saves a
   full-size screenshot in `out/rec-<name>-probe/`. Look at every shot, then refine the same file into the real take.
   The shots also make good covers for the release note. If the shots show test junk (hash names,
   "(TEST)" suffixes, empty states, a foreign locale), answer those requests in the browser with believable demo data: `ctx.route` +
   `json()`, or `rewrite()` to edit the real response. Capture the real response shape first and keep it exactly.
   Saves that would change shared data are answered in the browser too. Real writes only on records you created for
   the demo, and put back any setting you change.
4. **Privacy and tidy pass** on every screen:
   - private: phone numbers, emails, addresses, internal company names, test suffixes, time zones and locales that
     aren't the audience's. Blur with `MASK_SCRIPT` `blur`/`blurInputs`, rename with `rewrite()`;
   - untidy: ads, cookie and survey pop-ups, promo banners, chat bubbles. Hide them with `MASK_SCRIPT` `css` (works on
     web components, whose text the blur walk can't reach) or `hide`, and block ad/telemetry requests with
     `ctx.route(re, (r) => r.abort())`. A hidden ad's wrapper often keeps its height: hide the wrapper too, and check
     the first probe shot for an empty band.
5. **Write the take** from `take-example.mjs`, with an `await rec.mark('<beat>')` at the start of every beat. Plan
   the length before recording: video time is about the cursor's travel (0.5-1.4 s per move) plus at most 1.2 s per
   pause, so a 30 s video needs roughly 12-15 cursor moves. Run it. It
   writes `out/video-<name>.mp4`, `out/video-<name>.mp4.marks.json` and `out/moves-<name>.json`.
6. **Gate:** `bash $KIT/check-video.sh out/video-<name>.mp4 out/moves-<name>.json`, then open the sheet and every
   full-size `-at-<s>.png` frame it wrote. Pass means: every sudden change is one you meant, cursor teleports are
   `none`, the cursor is visible in every full-size frame (dialogs, after cuts), and nothing private or untidy shows.
   A scroll or an animation shows as a range (`14.1-14.5`); that is normal. Fix and re-record until it passes. A user
   who has to point out a jump is a failed gate.
7. **Voice.** Write `lines-<name>.json` as `[[start_s, "text"], ...]` with each line starting at its beat's mark (the
   marks are already in video time) and ending before the next mark. Kokoro `af_sky` speaks about 2.5 words per second:
   a 3 s beat holds about 7 words. To time a line to something that happens inside a beat (results appearing), use the
   sudden-change time from the check. Then
   `KOKORO_DIR=~/.cache/kokoro ~/.cache/kokoro/.venv/bin/python $KIT/voiceover.py lines-<name>.json voice-<name>.wav <duration>`
   (first time: `bash $KIT/setup-kokoro.sh`). It prints each line's span; re-time or shorten until it passes.
   The `<duration>` you pass sets the final length: `mux.sh` cuts the video to the voice track, so pass a shorter
   duration to trim a long ending.
8. **Mux and deliver:** `bash $KIT/mux.sh out/video-<name>.mp4 voice-<name>.wav <dest>/<feature>.mp4`. `<dest>` is
   where the user asked, else `out/narrated-feature-video/`. `open` it unless told not to. Write `<dest>/voice.json` with
   `{"voice": "af_sky", "speed": 1.0}` (what you used), so "same voice as before" can be looked up next time. Tell
   the user what is real and what was demo data. When the user asked for one-by-one review, stop after each video;
   when they asked for all, finish all and report once.

## Rules that keep a take natural (each one fixes a failure seen in real takes)

- **The cursor only moves through `h`** (`hover`, `click`, `scroll`, `scrollTo`, `moveTo`). Any `page.mouse.move` or
  `page.mouse.wheel` during recording teleports the drawn cursor. The one allowed direct move is before `attach()`.
- **Nothing scrolls by itself.** `h.hover`/`h.click` throw if the target is off screen, on purpose: an automatic
  scroll-into-view is an instant jump that looks like a cut. Bring targets in with `h.scrollTo(loc, top)` first.
- **The wheel scrolls what is under the cursor.** In a dialog or side panel, hover something inside it before
  scrolling, or the page behind scrolls instead.
- **Scope locators to where you are looking.** `dialog.getByText('Duration')`, not `page.getByText('Duration')`: the
  same words in the page behind a dialog make the cursor (and the scroll) go there.
- **Set up before `attach()`:** load, `settle(page, loc)` to the starting scroll position, wait for data. Anything
  after `attach()` is on camera.
- **Cut only on purpose:** `rec.pause()` → navigate or load → `settle()` → `rec.resume(h.park())`. Passing
  `h.park()` redraws the cursor where it was on the new page, still off camera. When a click navigates, click with a
  short wait (`h.click(link, 150)`) and pause right after, or the load is on camera. Prefer one continuous take when
  the path through the UI is short.
- **Point at the middle of wide things** (a diagram, a card): `h.hover(loc, wait, true)`. By default the cursor stops
  60 px in from the left edge, which suits text.
- **Let things land:** wait for a dialog or result to be visible before moving to it. Give each hover 0.8-1.5 s.
- **A beat gets longer by moving, not by waiting.** Encoding caps any motionless stretch at 1.2 s, so a 3 s wait adds
  1.2 s. When a voice line needs more room, add another hover (the next thing the line mentions) or a short scroll.

## Voice

- One sentence per beat, plain words, the benefit first ("Customers can now pay from their bank account"). No UI
  tours ("click the button labeled..."), no hype.
- Spell every acronym said letter by letter with spaces (`"A C H"`, `"C S V"`, `"M D N"`); leave real words alone
  (`"NASA"`). Captions aren't used, so the spoken spelling never shows.
- Same voice and speed for every video in a set. "Same voice as before": read `voice.json` next to the earlier
  videos or the project reference. With neither, use the default, `af_sky` at 1.0, and say so.

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Cursor jumps, then scrolls | `page.mouse.move/wheel` in the take | Only `h.*` during recording |
| "Looks like a cut" mid-take | Target was off screen; the page jumped to it | `h.scrollTo` first (the kit now throws instead) |
| Cursor flies to the wrong place in a dialog | Locator matched the page behind | Scope to the dialog |
| First second shows the old page | Stale screencast frame | Fixed in `Recorder.attach`; still `settle()` before attaching |
| Cursor missing inside a dialog | Modal `<dialog>` is in the top layer | Fixed in `CURSOR_SCRIPT` (popover); check the full-size frames |
| Cursor missing after a cut | New page, mouse not moved yet | `rec.resume(h.park())` |
| Voice ends after the action | Timed to script waits | Start each line at its beat's `mark` (video time) |
| A long hover came out short | 1.2 s cap on still frames | Lengthen with another hover or scroll |
| Ads or pop-ups on camera | Third-party content | `MASK_SCRIPT` `css`, `ctx.route(...).abort()` |
| Session suddenly signed out | Saved a signed-out storageState, or too many sign-ins | Save storageState only after a verified signed-in check; sign in once, reuse |
| Real data changed by a recording | A save went to the server | Answer saves in the browser; restore settings after |
