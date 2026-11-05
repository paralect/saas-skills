---
name: bento-features
description: "Generate an HTML bento grid where every cell is a working UI mockup of one product feature. Use when asked for a bento grid, a features section or a feature overview for a landing page."
---

# Bento features

Fill the slots below from the user's request and, inside a project, from its README, landing copy and code. Ask only when the product can't be worked out. Save the HTML file in the project and give its path.

You are a world-class design engineer, the caliber of Linear, Raycast, or Notion's design team. Generate a single self-contained HTML file that presents product features in a bento grid layout, based on the description below.

PRODUCT
{{a free-form description of the product, or a structured list of feature name plus what it does}}

## 1. What you're building

A responsive bento-style grid where each cell showcases one feature through a combination of a visual UI mockup and concise text. Each card is a mini product demo, not an icon with a paragraph, but a rendered slice of what that feature actually looks like in practice.

Reference style: the feature grids on novu.co, linear.app, raycast.com, or amie.so, where every card contains a realistic product UI fragment alongside a title and a one-liner.

## 2. Input handling

The input is either a free-form description of a product or feature set, or a structured list of feature name plus description.

Extract the product name or context, and each distinct feature with its name and what it does.

- Broad product description → decompose it into 4 to 8 presentable features
- A single feature → generate a focused 2 to 4 card breakdown of that feature's aspects

## 3. Design system

### 3.1 Theme detection

- Developer tools, analytics, monitoring, security → dark theme
- Consumer, lifestyle, health, education → light theme
- Finance, enterprise, B2B SaaS → dark or muted dark
- Creative tools, design, media → either, lean dark
- If ambiguous, default to dark

### 3.2 Dark theme palette

- Page background: `#06070A` to `#0C0D12` (near-black with a blue or purple micro-tint)
- Card background: `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.05)`
- Card border: `1px solid rgba(255,255,255,0.06)`, slightly brighter on hover
- Mockup area inside a card: a lighter surface, `rgba(255,255,255,0.03)`, or a subtle gradient
- Text: `#F1F1F3` titles, `#8A8F98` descriptions, `#5A5F6B` labels inside mockups
- Accent: ONE dominant color derived from the product domain. Use it sparingly, for badges, active states, glow effects, and key UI elements inside mockups. Not everywhere.

### 3.3 Light theme palette

- Page background: `#F8F9FA` to `#FFFFFF`
- Card background: `#FFFFFF` with `shadow-sm` and a `1px #E8EAED` border
- Mockup area: `#F3F4F6` or a subtle gradient
- Text: `#111827` titles, `#6B7280` descriptions
- Accent: same domain logic, slightly more saturated

### 3.4 Typography

- Google Fonts.
- Display font for card titles, from: Instrument Serif, Cabinet Grotesk, Satoshi, General Sans, Syne, Plus Jakarta Sans, Bricolage Grotesque, Space Grotesk. Rotate your choices.
- Pair with a clean sans for descriptions and mockup UI text: DM Sans, Geist, Manrope, Outfit.
- Never use Inter, Roboto, or Arial.

### 3.5 Visual effects

Applied per card, selectively:

- Subtle glow behind key mockup elements (radial-gradient, position absolute)
- Glass-morphism on floating UI fragments within cards (backdrop-filter: blur)
- Grain or noise overlay on the page background, not on the cards
- Hover: card border brightens, subtle `scale(1.01)`, shadow deepens
- Load animation: cards stagger in with fade plus translateY, scroll-triggered with IntersectionObserver
- 1 or 2 cards can carry a slow ambient animation inside: a pulsing dot, a rotating gradient, a counting number

## 4. Grid layout

Use CSS Grid with a 3-column layout. All rows are the same height. Visual rhythm comes from varying column spans (1-col or 2-col wide), NOT row spans. Never use row spans. This prevents empty cells and broken layouts.

The grid: `grid-template-columns: repeat(3, 1fr)` with equal auto rows.

### 4.1 Layout patterns by feature count

4 features:

```
[ 2-col wide ] [ 1-col ]
[ 1-col ] [ 2-col wide ]
```

5 features:

```
[ 1-col ] [ 1-col ] [ 1-col ]
[ 2-col wide ] [ 1-col ]
```

6 features:

```
[ 1-col ] [ 1-col ] [ 1-col ]
[ 2-col wide ] [ 1-col ]
[ 1-col ] [ 2-col wide ]
```

7 features:

```
[ 2-col wide ] [ 1-col ]
[ 1-col ] [ 1-col ] [ 1-col ]
[ 1-col ] [ 2-col wide ]
```

8 features:

```
[ 2-col wide ] [ 1-col ]
[ 1-col ] [ 1-col ] [ 1-col ]
[ 1-col ] [ 2-col wide ]
[ 1-col ] [ 1-col ] [ 1-col ]
```

### 4.2 Critical grid rules

1. Every row must fill all 3 columns exactly: one 2-col plus one 1-col, or three 1-col. No partial rows.
2. Never use `grid-row: span 2` or any row spanning. This causes layout breakage.
3. Use `grid-column: span 2` for wide cards, nothing else.
4. Alternate the position of 2-col cards between rows, left-aligned then right-aligned, for visual variety.

### 4.3 Wide versus narrow card layout

- **1-col cards**: mockup zone on top (~60%), text zone on the bottom (~40%). Vertical stack.
- **2-col wide cards**: mockup zone on the left or right (~55%), text zone on the opposite side. Use `display: flex` with `flex-direction: row` inside the card. This uses the horizontal space well instead of leaving an awkwardly wide mockup.

### 4.4 Responsive

- Mobile, under 768px: single column, all cards full width
- Tablet, 768 to 1024px: 2-column grid, wide cards span 2
- Desktop, 1024px and up: full 3-column grid

Grid gap 16 to 20px. Cards get generous padding, 24 to 32px. Card border-radius 16 to 20px.

## 5. Card anatomy

Each card has 2 zones.

### 5.1 Mockup zone

About 60% of a narrow card, about 55% of the width on a wide one.

A visual representation of the feature. This is NOT an icon or an illustration. It is a built-from-HTML UI fragment that looks like a piece of the actual product.

| Feature type | Mockup approach |
|---|---|
| Search / filter | Command palette UI (⌘K) with a search results list |
| Notifications | Notification panel with a bell badge plus message items with avatars |
| Payments | Transaction table rows with amounts, dates, status badges |
| Analytics | Mini chart (CSS bars or lines) plus stat cards |
| Settings / prefs | Toggle switches, dropdown selections, radio groups |
| Collaboration | Avatar stack plus comment bubble plus cursor indicators |
| API / integrations | Code snippet block plus endpoint cards with method badges |
| Scheduling | Calendar mini-view with colored event blocks |
| Auth / security | Login form fragment plus shield icon plus permission toggles |
| Import / export | File type icons plus progress bar plus format selector |

The mockup should be cropped and partial. It should look like you are peeking into a window of the product, not seeing the entire screen. Elements can overflow and be clipped by the card's `overflow: hidden`. This creates a sense of a larger product behind each card.

### 5.2 Text zone

- **Title**: bold, 18 to 24px, display font. The feature name as a punchy 2 to 4 word label.
- **Description**: 14 to 16px, muted color, 1 to 2 lines max. What this feature does and why it matters.

## 6. Mockup construction rules

1. **Realistic fictional data**: "Alex Thompson", "$12,450.00", "2 hours ago", "v2.4.1". Never lorem ipsum.
2. **Micro-details that sell realism**: colored status dots (green active, amber pending, red error), avatar circles with gradient fills or initials, keyboard shortcut badges (⌘K, ⇧⌘P), toggle switches in on and off states, breadcrumb trails, notification count badges, relative timestamps ("2m ago", "Yesterday"), truncated text with ellipsis suggesting more content.
3. **Depth and layering**: cards within cards, floating tooltips, dropdown overlays, overlapping panels at slight offsets.
4. **Consistent visual language**: all mockups in the grid should feel like they belong to the same product. Same border radius on inner elements, same spacing rhythm, same text sizing.
5. **Strategic use of accent color**: only in interactive elements, buttons, active tabs, toggle states, badges. The majority of the mockup stays neutral.

## 7. Technical requirements

1. Single HTML file, everything inline
2. Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
3. Google Fonts via `<link>`
4. Lucide icons via CDN: `https://unpkg.com/lucide@latest`, initialize with `lucide.createIcons()`
5. No frameworks, no build tools
6. Vanilla JS only, for staggered load animations (IntersectionObserver), hover effects, and optional ambient animations inside cards
7. Responsive: single column on mobile, full bento grid on desktop
8. All CSS custom properties in `<style>` within `<head>`
9. Smooth animations, transform and opacity only

## 8. What NOT to do

- Don't use row spans. This is the number 1 cause of broken layouts, empty gaps, and misaligned content.
- Don't leave partial rows. Every row must sum to exactly 3 columns.
- Don't use icons-with-text as a substitute for actual UI mockups.
- Don't put lorem ipsum or "Feature description goes here" anywhere.
- Don't make mockups look like wireframes. They should feel like a real product.
- Don't use more than 1 accent color. Consistency creates quality perception.
- Don't create cards that are just text on a gradient background.
- Don't add decorative illustrations or abstract shapes. The product UI IS the decoration.
- Don't over-animate. 1 or 2 ambient animations max across the whole grid.
- Don't forget the grid gap and padding. Generous whitespace is what separates good from great.
- For wide cards, don't just stretch the narrow card layout. Use a side-by-side row layout with the mockup on one side and the text on the other.

If you include a copyright line, set the year to 2026.

Return the complete HTML file and nothing else.
