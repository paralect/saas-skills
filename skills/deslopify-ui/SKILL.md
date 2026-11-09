---
name: deslopify-ui
description: "Find and fix the 21 patterns that make a page or app screen look AI-generated: purple gradients, glow and grids on dark, glass cards, emoji icons, all caps labels over every heading, colored italic accents, borders around everything, badges that mean nothing, placeholder images, fake testimonials, overstuffed dashboards, motion with nothing to say and more. Use when asked to deslopify a UI, remove AI slop from a design, make a page look less AI-generated or less like a template, or review a page or screen for AI design patterns."
---

# Deslopify UI

AI builds the same page every time, and people have seen it so often that they spot it right away and trust the product less. This skill finds the 21 patterns behind that look on a page or app screen, then fixes them in the project's own code, colors and fonts.

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Unless the user names another place, save everything it makes in `out/deslopify-ui/` under the current project.

The 21 patterns, with what to look for in code and how to fix each, are in `references/patterns.md`. Read it in full before step 2.

## What to work on

- The page or screen the user names: a route, a component, an HTML file or a URL.
- Nothing named: the landing page, or the app's main screen if there is no landing page.
- Only a URL and no code for it here: review it (steps 1, 2 and 5) and say the fixes need the code.
- "Just review it", "audit", "check": steps 1, 2 and 5, no edits.

## Steps

### 1. Look at it

Read the component and everything it renders: sections, copy, styles, the project's color and font tokens, the icon set. If the page can be opened (a running dev server, an HTML file, a public URL), take a full-page screenshot to `out/deslopify-ui/before.png`. Patterns like low contrast, glow and overstuffing are easier to judge on the picture than in the code.

### 2. Audit

Go through all 21 patterns in `references/patterns.md`, in order. For each one, note whether it's there, where (file and line, or the section on the page) and how many times.

One pattern on its own is fine. What reads as AI-made is several of them on one page. Skip a pattern when it does a real job, as each entry in `patterns.md` says under "Leave it when": a colored stripe on a real warning, monospace on a developer tool, a badge on a paid feature.

### 3. Fix

Apply the fix for every pattern you found, in the project's own stack and components.

- **Remove before you add.** Most fixes take something away: a gradient, a border, a glow, a badge, a label, an animation. Don't bring in a new palette, font or illustration style; use the project's tokens.
- **Don't make things up.** No new testimonials, customer logos, numbers or team photos. Where proof or images are fake and the real ones aren't in the project, remove the block, or keep the slot with a clear `TODO` and list it for the user. A real product screenshot from the repository beats any drawing.
- **Copy changes stay small.** Digits instead of numbers in words, a short title that starts with a verb instead of a string of nouns, the all caps labels gone. Don't rewrite the pitch.
- **Keep what works.** Links, forms, analytics, ids, routes and accessibility labels stay as they are. Keep 1 memorable thing on the page and keep the rest simple.

### 4. Check

Go through the 21 patterns again on the result. Check body text contrast against its background, at least 4.5:1. If the page can be opened, take `out/deslopify-ui/after.png` at the same size as the "before" one and compare them.

### 5. Report

Write `out/deslopify-ui/report.md`:

- The patterns found, each with where it was and what changed (or why it stayed)
- The files changed
- What only the user can provide: real screenshots, real quotes with names, real customer logos

In the reply, give the count ("9 of 21 found, 8 fixed"), the 3 changes that matter most, what the user still has to provide, and the paths of `before.png`, `after.png` and `report.md`.
