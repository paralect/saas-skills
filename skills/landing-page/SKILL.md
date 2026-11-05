---
name: landing-page
description: "Generate a polished hero landing page as one self-contained HTML file, with a working demo of the product's interface as the centerpiece. Use when asked for a landing page, hero section, marketing page or product homepage mockup."
---

# Landing page

Fill the slots below from the user's request and, inside a project, from its README, landing copy and code. Ask only when the product can't be worked out. Save the HTML file in the project and give its path.

You are a world-class design engineer, the caliber of Linear, Raycast, or Notion's design team. Generate a single self-contained HTML file that serves as a hero section demo visualization for the product below.

PRODUCT
{{free-form description, or product name plus a list of features}}

COLOR SCHEME
{{dark or light. Leave blank to let the theme detection rules in 3.1 decide.}}

If a color scheme is given, follow it when choosing styles for the page.

## 1. What you're building

A responsive hero page that showcases what the product does through a visual demo, not just text, but a rendered piece of the product's interface. Think of it as an interactive billboard:

1. A headline
2. A subtitle
3. A central demo area showing a stylized, partially functional prototype of the product's core experience

The demo area is the star. It should contain realistic-looking UI elements that communicate the product's value at a glance:

- Dropdown menus, data tables, cards, dashboards
- Chat bubbles, code editors, kanban boards
- Calendar views, notification panels
- Whatever fits the product

These are not wireframes or gray boxes. They look like a real product: proper typography, realistic fictional data, status badges, avatars, icons.

## 2. Input handling

The input will be either a free-form paragraph describing the product, or a structured list of product name plus features.

Extract from it:

1. The product name
2. Its core value proposition
3. 2 to 4 key features
4. What kind of UI the product would have

If the input is vague, make smart assumptions. A "project management tool" implies boards, lists, and cards. A "payment platform" implies transaction tables and dashboards.

## 3. Design system

### 3.1 Theme detection

Analyze the product's domain and audience:

- Developer tools, analytics, monitoring, security → dark theme
- Consumer, lifestyle, health, education → light theme
- Finance, enterprise, B2B SaaS → dark or muted dark
- Creative tools, design, media → either, lean dark
- If ambiguous, default to dark

### 3.2 Dark theme palette

- Background: `#06070A` to `#0C0D12` range (near-black, slightly blue or purple tinted)
- Card surfaces: `rgba(255,255,255,0.03)` to `rgba(255,255,255,0.06)` with 1px border `rgba(255,255,255,0.06)`
- Text: `#F1F1F3` headings, `#8A8F98` body, `#5A5F6B` muted
- Accent: derive from the product's domain (purple for dev tools, blue for productivity, green for finance, amber for creative tools). Pick ONE dominant accent.

### 3.3 Light theme palette

- Background: `#FAFBFC` to `#FFFFFF`
- Card surfaces: white with subtle shadows and 1px `#E5E7EB` borders
- Text: `#111827` headings, `#6B7280` body
- Accent: same logic as dark, but slightly more saturated

### 3.4 Typography

- Use Google Fonts
- Pick a distinctive display font for the headline: Instrument Serif, Playfair Display, Cabinet Grotesk, Satoshi, General Sans, Syne, Plus Jakarta Sans. Vary your choice, never default to the same one.
- Pair with a clean geometric sans for body text and UI mockups: DM Sans, Geist, Manrope
- Never use Inter, Roboto, or Arial

### 3.5 Visual effects

Applied tastefully, not all at once:

- Gradient orb glows behind the demo area (CSS radial-gradient, position: absolute, filter: blur)
- Subtle grain or noise overlay (CSS or inline SVG filter)
- Soft vignette on the page edges
- Glass-morphism on cards (backdrop-filter: blur plus transparency)
- Gentle floating animation on decorative elements (CSS @keyframes, 6 to 10s duration, ease-in-out)
- Subtle parallax on mouse move for the demo area (lightweight JS, transform: translate3d, requestAnimationFrame)
- Staggered fade-in on load for content elements

## 4. Layout structure

┌─────────────────────────────────────────────┐
│  [subtle nav hint]                          │
│                                             │
│         PRODUCT NAME (display font)         │
│      One-line value proposition (large)     │
│       Supporting line (muted, smaller)      │
│                                             │
│        [ CTA button ]  [ secondary ]        │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │      INTERACTIVE DEMO AREA          │   │
│   │      (the product UI mockup)        │   │
│   │                                     │   │
│   │   - realistic components            │   │
│   │   - fictional but believable data   │   │
│   │   - subtle hover interactions       │   │
│   │   - floating/overlapping elements   │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│      [optional: small feature pills]        │
│                                             │
└─────────────────────────────────────────────┘

The demo area should NOT be a flat screenshot. Build it from layered HTML elements: overlapping cards, floating tooltips, partially visible sidebars, creating depth and visual richness. Elements can break out of their container slightly for a dynamic feel.

## 5. Demo area construction rules

1. Identify the product's primary interface. What does the user see most? A feed? A dashboard? An editor? A conversation?
2. Build 2 to 4 overlapping UI fragments that represent that interface. A notification product might show a bell icon with a badge, an expanded notification panel, and a settings dropdown, all overlapping at slight angles.
3. Use realistic fictional data: names like "Sarah Chen" or "Marcus Rivera", amounts like "$4,280.00", dates like "Jan 15, 2025", statuses with colored badges ("Active", "Pending", "Completed").
4. Include micro-details: avatar circles with initials or gradient fills, status dots, chevron icons, toggle switches, progress bars, keyboard shortcuts (⌘K).
5. Add depth: subtle box-shadows, layered z-index, slight rotations (1 to 3deg), scale differences between foreground and background elements.

## 6. Technical requirements

Output plain HTML styled with Tailwind utility classes, and serve Tailwind from the CDN script. No custom CSS framework, no build step, no bundler.

1. Single HTML file, everything inline
2. Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
3. Google Fonts via `<link>`
4. Lucide icons via CDN: `https://unpkg.com/lucide@latest`, initialize with `lucide.createIcons()`
5. No frameworks, no build tools
6. Vanilla JS only, and only for: parallax mouse tracking, scroll-triggered animations, hover interactions
7. Responsive: looks great at 320px through 1440px and up
8. All CSS custom properties defined in `<style>` within `<head>`
9. Smooth, performant animations. Use transform and opacity only, and leverage will-change sparingly.

## 7. What NOT to do

- Don't generate a generic landing page template with stock placeholder text
- Don't use lorem ipsum anywhere. Every text element should feel intentional.
- Don't create boring centered-text-with-image layouts
- Don't add excessive decoration that distracts from the demo
- Don't use emoji as design elements
- Don't make the demo area a static image or flat mockup. It should feel alive.
- Don't include actual functionality or backend calls. It's a visual demo only.
- Don't over-animate. Motion should be subtle and purposeful.
- Don't use clichéd gradient backgrounds (the classic purple-to-blue wash)

If you include a copyright line, set the year to 2026.

Return the complete HTML file and nothing else.
