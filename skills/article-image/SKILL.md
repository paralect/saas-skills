---
name: article-image
description: "Turn a paragraph or headline from a blog post into the one image that runs with it, in one of 8 house styles. Use when asked for an article image, blog illustration, post header, cover image or social image for a post."
---

# Article image

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them.

Fill the slots below from the post and the user's request. When they don't name a style, pick the one that fits the post. Generate the image with the image model you have access to and save it in `out/article-image/` under the current project, unless the user names another place. If you have none, give the user the filled-in prompt to paste into one.

## Styles

- `styles/hand-drawn-ink-sketch.md`: Hand drawn ink sketch. Black ink on white, stick figures and wobbly arrows, the diagram you would draw on a whiteboard
- `styles/retro-comic-illustration.md`: Retro comic illustration. Brush ink on aged paper, mid-century figures, grey wash, and exactly 1 color in the frame
- `styles/isometric-illustration.md`: Isometric illustration. Flat isometric line work on a pale field, faceless figures, and 1 accent color doing the pointing
- `styles/technical-blueprint.md`: Technical blueprint. Navy drafting sheet with dimension lines and callouts, for posts that take something apart
- `styles/color-block-outline.md`: Color block outline. One saturated field edge to edge, with a white outlined object floating in it and nothing else
- `styles/grainy-isometric.md`: Grainy isometric. One soft isometric object on a flat saturated field, film grain over everything, labels borrowed from a detection model
- `styles/gradient-grain.md`: Gradient grain. Big simple shapes under heavy grain, blended from 2 or 3 hues, with hairline detail over the top
- `styles/isometric-desk-scene.md`: Isometric desk scene. A desk seen from above in one pool of light, objects cropped by the frame, the product in the bright part

## Prompt

You are generating 1 image to run with a B2B software blog post. The image carries 1 idea from the post. It is not decoration, not a stock photo substitute, and not a screenshot.

PARAGRAPH OR HEADLINE
{{the part of the post the image sits with}}

STYLE BLOCK
{{paste the full contents of 1 file from styles/}}

TITLE LETTERING
{{up to 4 words to letter into the image, or "none"}}

ACCENT COLOR
{{1 color for the 1 element that matters, or "none" if the style is monochrome}}

## 1. What the image has to do

- Carry 1 idea. If the paragraph makes 2 points, draw the one the reader would argue with.
- Hold up at 400px wide in a post card, a search result, and a link preview. 1 silhouette, readable at a glance, no fine detail carrying the meaning.
- Wide 16:9 landscape. The bottom left and bottom right corners stay empty so a logo can sit there later.
- 6 visual elements maximum. At least 30% of the canvas stays empty.

## 2. Translating software into something drawable

Software has no shape, so draw the physical object that does the same job. Nothing on screen may be a screenshot or a UI.

- A dashboard or analytics tool → a framed chart, a pinned wall graph, a stack of printed reports
- Email, outbound, a campaign → envelopes, a mailbag, a mail slot, an empty in tray
- A signup flow, onboarding, a funnel → a queue at a counter, a turnstile, a run of steps
- A backlog, a queue, a pipeline → a conveyor, a spike file, a row of paper trays
- Pricing or packaging → framed plaques, price cards on easels, a menu board
- A database or a warehouse → filing cabinets, ledgers, crates, card index drawers
- Search or research → a card catalog, a magnifying glass, a folded map
- A meeting or a sales call → a table with 2 or 3 people around it

## 3. Composition patterns

Choose the 1 pattern that fits the idea:

1. **A process or pipeline** → left to right or top to bottom stations connected by arrows, 1 per step, with the bottleneck marked.
2. **A comparison of 2 things** → 2 shapes, columns, or objects side by side with 1 or 2 word labels underneath.
3. **A framework or a 2x2** → crossed axes with labeled ends, or a labeled ring, with a marker where the subject sits.
4. **A change of approach** → the same character twice on 1 baseline, defeated on the left among scattered paper, upright on the right holding the resolved thing.
5. **A run of attempts** → the same character 3 times, left to right, 3 stages of 1 action, each with a different posture.
6. **A single idea with inputs** → a central object with 2 to 4 smaller labeled things feeding into it.
7. **A choice between 2 options** → 2 objects or doorways side by side with a figure between them, body already turned toward 1.
8. **Uncertainty ahead: a roadmap, a market, a bet** → the figure small and seen from behind, holding a map or a lamp, facing a large empty suggestion of a landscape.

If none of them fits, use pattern 6.

## 4. Never

- Screenshots, browser windows, app icons, chat bubbles, phones, monitors
- Paragraphs of text, captions, watermarks, signatures inside the image
- The literal noun from the headline drawn as a label. Draw what happens, not the word.
- A second accent color, or a style detail the style block did not ask for

## 5. Title lettering

- If the lettering input is "none", draw no text at all. Use this when the headline already sits above the image on the page.
- Otherwise letter it across the top, 4 words maximum, pulled from the headline rather than the whole of it. A leading number is allowed, like "2. KILL THE FREE TRIAL". The style block says how the lettering is drawn.
- Any label inside the drawing is 1 or 2 words.

## 6. Task

1. Read the paragraph and name the 1 idea, and the beat under it: stuck, overwhelmed, deciding, seeing it clearly, setting off.
2. Pick the 1 composition pattern from section 3 that carries that beat.
3. Cast it: who or what is in the frame, and the 3 props at most, each translated through section 2.
4. Decide the 1 element that gets the accent color. It is the thing the idea turns on.
5. Apply the style block verbatim and generate the image.
