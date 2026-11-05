---
name: low-res-mockup
description: "Generate a stripped-back HTML mockup of a screen, with grey blocks and skeleton bars instead of copy. Use when asked for a wireframe, low-fidelity or low-res mockup, skeleton layout or layout sketch."
---

# Low-res mockup

Fill the slots below from the user's request and, inside a project, from its README, landing copy and code. Ask only when the product can't be worked out. Save the HTML file in the project and give its path.

Generate a single self-contained HTML file: a low detail mockup of the screen below. Grey blocks and skeleton bars, no readable copy. It is the thing you sketch before anyone argues about wording.

COMPONENT
{{what the screen or component is}}

## 1. Output

- 1 HTML file, complete and standalone. Return the file and nothing else: no explanation, no markdown fence, no commentary before or after.
- All CSS inline in a single `<style>` block. No CDN links, no webfonts, no JavaScript, no images. It has to render with no network.
- Laid out for a 1280px viewport, and it must not break down to 480px. Use flex and grid, never fixed pixel positioning.

## 2. The palette, and there is only 1

- Page background `#ffffff`, panels `#fafafa`, blocks `#eceded`, stronger blocks `#dcdedf`, the 1 primary element `#c4c7c9`, borders `1px solid #e6e7e8`, radius 6px.
- Nothing is colored. No brand color, no accent, no shadows, no gradients.
- Emphasis comes from size and grey value only. The primary button is the darkest block on the screen.

## 3. Skeletons instead of text

- Every line of copy is a rounded grey bar 8px to 14px tall. Headings get taller, darker bars. Body copy gets 2 or 3 bars of uneven width, 40% to 90%, with the last one short.
- Never write readable words. No lorem ipsum, no placeholder sentences, no labels.
- Icons are 16px to 20px grey squares or circles. Avatars are circles. An image or a screenshot is 1 large block with a slightly darker inner rectangle.
- A chart is inline SVG in greys: bars of uneven height, or a single polyline over faint gridlines. A sparkline is a short polyline.
- Form fields are bordered blocks with a short bar inside. Checkboxes are small squares.

## 4. Structure over detail

- Show the layout and the hierarchy, nothing else. If a real screen would have 12 nav items, draw 4.
- Every region a real screen would have is present and correctly proportioned: nav, sidebar, header, content, table, footer.
- Spacing on an 8px scale, generous. The mockup should read as calm, not cramped.
- No hover states, no active states, no modals, no interactivity of any kind.

## 5. Task

1. Read the component and list the regions it needs, in the order they stack.
2. Decide the 1 element that carries the primary action, and make it the darkest block.
3. Write the file.
