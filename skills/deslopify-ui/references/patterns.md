# 21 signs of AI slop in design

From Paralect's article [Signs of AI slop in design](https://www.paralect.com/blog/signs-of-ai-slop-in-design). Each entry: what it is, what to look for in code, the fix, and when to leave it.

## 1. Colored stripe on rounded cards

A thick colored line on one side of every card, to make plain content look designed. Readers learn to ignore it, so it stops working on real warnings.

- **Look for:** `border-l-4`, `border-left: 3px+ solid <color>` on cards, list items or callouts that aren't alerts.
- **Fix:** remove the stripe. Keep colored edges for status: errors, warnings, things that need action.
- **Leave it when:** it marks a real status.

## 2. Borders around every block

A border around each section, then around each item inside it, boxes inside boxes. When everything has an outline, borders stop showing what belongs together.

- **Look for:** `border` on a container and on its children, nested cards, every stat, row and chart in its own box.
- **Fix:** group with spacing and headings first. Keep a border only where a block must stand apart: a selected item, a form, an input.
- **Leave it when:** it separates something the user acts on.

## 3. Colored italic text for accent

A bold sans headline with 1 word in colored italic serif, repeated in every heading, on a word that is rarely the important one. It adds a 2nd font and an accent color for nothing.

- **Look for:** `<em>`, `<i>`, `italic`, `font-serif` with a color class inside headings.
- **Fix:** set the heading in 1 font and 1 color. Stress a word only when the message needs it, once per page at most, with weight or size.
- **Leave it when:** it's the brand's own type style, used on purpose.

## 4. All caps label above every heading

A tiny uppercase word above each heading (an eyebrow) that names the section type: FEATURES, PRICING, TESTIMONIALS. People can already see what the section is.

- **Look for:** `uppercase`, `tracking-wide(st)`, `text-xs` labels right before an `h1`/`h2`/`h3`.
- **Fix:** delete it. If it carries real information, like a date or a category people filter by, work that into the heading.
- **Leave it when:** it's real information, not a section name.

## 5. Badges and dots that mean nothing

Pills like NEW, BETA, AI or a green "● LIVE" above titles, colored dots by section names, each in its own color with no meaning. If every feature is new, none of them are.

- **Look for:** `rounded-full` pills with 1 or 2 words, `animate-pulse` dots, "Live", "New", "Beta", "AI" labels.
- **Fix:** remove them. Use a badge only when it changes what the user does, like a paid feature or a real status, and give each color 1 meaning across the product.
- **Leave it when:** the status is real (something really is live, really is in beta).

## 6. Monospace labels and inputs

Monospace for labels, tags, inputs and buttons, often in caps with underscores (`EMAIL_ADDRESS`, `JOIN_WAITLIST`, `// 01 —`). It looks borrowed, and by now it reads as a template.

- **Look for:** `font-mono` outside code; `_` and `//` in visible labels.
- **Fix:** set them in the main font, in normal case. Keep monospace for code, numbers in tables and things people copy.
- **Leave it when:** the product is for developers and the text really is code.

## 7. Numbers written as words

"Three steps", "ten thousand teams", "Step one". People scan for digits, and words hide the most concrete part of the message.

- **Look for:** one, two, three … ten, hundred, thousand in headings, buttons and labels.
- **Fix:** write digits: 3, 10,000, Step 1.
- **Leave it when:** it's part of a name or a fixed phrase.

## 8. Long titles full of nouns

Titles that sound like product categories ("Comprehensive Workflow Management and Collaboration Solution for Modern Distributed Teams") and descriptions that list features. Nobody can tell who it's for or what changes for them.

- **Look for:** titles over about 8 words, chains of nouns, words like comprehensive, seamless, solution, platform, enterprise-grade, end-to-end.
- **Fix:** a short title that starts with a verb and names the result for a specific person, with 1 line under it that says who does what. Move the feature list lower. Keep the product's own claims; don't invent new ones.
- **Leave it when:** never as a headline.

## 9. Emoji as icons

✨ in pills, 🚀 ⚡ 🔒 🎯 💡 as bullets, buttons and headings. They look different on every device, don't match the icons or colors, and make a product page read like a chat.

- **Look for:** emoji characters in markup and copy.
- **Fix:** use the project's icon set, the same one everywhere, or no icons; a plain list reads fine.
- **Leave it when:** the product is about emoji or chat and they're content.

## 10. Placeholders instead of avatars, logos and images

Initials in colored circles, grey LOGO boxes, empty frames with an image icon, meant to be replaced before launch.

- **Look for:** initials avatars, "Logo" boxes, placeholder images, `placehold.co`, `via.placeholder`, empty `bg-gray` frames, stock icon in an empty box.
- **Fix:** use real images from the project: a product screenshot, team photos, real customer logos. When none exist, remove the block or keep a clearly marked `TODO` for the user. Every important page needs at least 1 real image.
- **Leave it when:** never on a page that ships.

## 11. Overstuffed screens

Adding an element costs AI nothing. Dashboards with a card for every metric, an AI insight banner, a tip of the day, a checklist, quick actions and a "What's new" box; landing pages with chips, extra buttons, floating stats and banners. Together they compete, and people can't find what they came for.

- **Look for:** more than 1 primary button per view, banners, tips, "What's new", checklists, "View details" on every card, sidebars with 10+ items, 4+ metric cards.
- **Fix:** for every element, ask what the user does with it; remove it if the answer is nothing. A dashboard answers the 1 or 2 questions people open it for. A landing hero needs a headline, a line under it, a button and a picture of the product.
- **Leave it when:** users really act on it every visit.

## 12. Visual metaphors explained with labels

Simple shapes with the idea written on them: a scribble labeled CHAOS, an arrow labeled INPUT, a glowing circle labeled AI ENGINE. A picture that needs a label adds nothing.

- **Look for:** diagrams of abstract shapes with uppercase labels, "from chaos to clarity" sections.
- **Fix:** show the real thing, what customers use today and what they get. If you can't show it, write 1 clear sentence and drop the drawing.
- **Leave it when:** it's a real architecture diagram for a technical audience.

## 13. Demos made of text

A "See it in action" section that's paragraphs and bullet points instead of the product working.

- **Look for:** demo, "how it works" or "in action" sections with no screenshot, video or UI.
- **Fix:** show the product doing 1 real task: a screenshot, a short video or a GIF. Keep the text to a caption.
- **Leave it when:** never; text isn't a demo.

## 14. Glass cards

Frosted glass on static cards over color blobs. It lowers contrast, slows the page and makes text harder to read.

- **Look for:** `backdrop-blur`, `backdrop-filter`, `bg-white/10`, translucent cards over blurred gradient orbs.
- **Fix:** solid backgrounds from the project's tokens; remove the orbs. Keep blur only for things that sit on top of content, like a menu or a sticky header.
- **Leave it when:** it's an overlay over moving content.

## 15. Same radius and shadow on everything

1 corner radius and 1 soft shadow on buttons, cards, inputs, tags and avatars. People can't tell what's clickable, and the page goes flat.

- **Look for:** the same `rounded-*` and `shadow-*` on every element type.
- **Fix:** give different things different shapes. Buttons and cards don't need the same corners; most elements need no shadow. Keep shadows for things that float: menus, dialogs, popovers.
- **Leave it when:** the design system defines it on purpose.

## 16. Light gray text on white

Secondary text made lighter and lighter to look clean. It disappears on a phone in the sun and fails accessibility checks.

- **Look for:** `text-gray-300/400` (or similar) on white for body text, `opacity` on text.
- **Fix:** body text at least 4.5:1 contrast against its background. Keep light gray for things people can skip.
- **Leave it when:** the text really is skippable (a timestamp, a footnote) and still readable.

## 17. Animation and motion with nothing to say

Pulsing dots, blinking cursors, bouncing buttons, scrolling logo strips. When many things move, people can't focus.

- **Look for:** `animate-pulse`, `animate-bounce`, `animate-ping`, marquees, blinking cursors, infinite keyframes.
- **Fix:** animate only things that change. If something must move on its own, let people pause it.
- **Leave it when:** it shows a real change of state (loading, a live update).

## 18. Heavy appear animations on every block

Every block fades in, slides up and unblurs on scroll. Fast scrollers see blank space, and if the script fails the content never shows.

- **Look for:** reveal-on-scroll libraries (AOS, framer-motion `whileInView`), `opacity-0` with `translate-y` or `blur` and staggered delays.
- **Fix:** show content right away. If you want motion, animate 1 thing that matters, under 300ms, and respect `prefers-reduced-motion`.
- **Leave it when:** never on every block.

## 19. Proof nobody can check

"Trusted by 10,000+ teams" over grey logos, 5-star quotes from "Sarah J., CEO, TechCorp" with an initials avatar. Fake proof is worse than none.

- **Look for:** round numbers with +, first name and initial, generic company names, star ratings with no source.
- **Fix:** real names, roles, photos and a link to the source, if the project has them. If not, remove the section and list it for the user. Never write new quotes or numbers.
- **Leave it when:** it's real and checkable.

## 20. Purple gradients

Purple-to-blue on buttons, headlines and backgrounds. It says "AI startup" before anyone reads a word. Gradient text is the worst case, since it's also harder to read.

- **Look for:** `bg-gradient-*` / `linear-gradient` with purple, violet, indigo, fuchsia or cyan stops; `bg-clip-text text-transparent`.
- **Fix:** 1 solid color from the brand for text and buttons. Make important words bigger or bolder instead.
- **Leave it when:** purple really is the brand color, and then solid, not a gradient.

## 21. Glow, neon and grid lines on dark

A glow behind the hero, neon edges on cards, a faint grid in the background. When everything glows, nothing stands out.

- **Look for:** large blurred colored shadows, `blur-3xl` orbs, colored `box-shadow`/`drop-shadow` on cards, `bg-grid` or repeating-linear-gradient line backgrounds.
- **Fix:** remove the glow and the grid (grids belong on maps and canvases). Keep a little neon only where you want people to look.
- **Leave it when:** it's on the 1 thing you want people to look at.
