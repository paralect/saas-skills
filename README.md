# SaaS Skills

Agent skills for shipping B2B SaaS: landing pages, dashboards, logos, share cards, demo videos and blog images. See the real output of each one at [paralect.com/skills](https://www.paralect.com/skills).

## Install

Pick from the list:

```bash
npx skills add paralect/saas-skills
```

One skill:

```bash
npx skills add paralect/saas-skills --skill og-image
```

All of them, for every project:

```bash
npx skills add paralect/saas-skills --all --global
```

## Skills

### Design

| Skill | What it does |
| --- | --- |
| [landing-page](https://www.paralect.com/skills/landing-page) | A hero landing page in one HTML file, with a working demo of the product's interface |
| [saas-dashboard](https://www.paralect.com/skills/saas-dashboard) | An HTML dashboard that looks like a real shipped product |
| [bento-features](https://www.paralect.com/skills/bento-features) | A bento grid where every cell is a working UI mockup of one feature |
| [low-res-mockup](https://www.paralect.com/skills/low-res-mockup) | A stripped-back HTML mockup of a screen, skeletons instead of text |
| [saas-logo](https://www.paralect.com/skills/saas-logo) | A flat geometric logo mark, delivered as transparent PNGs of the mark and its app-icon tile |

### Launch

| Skill | What it does |
| --- | --- |
| [og-image](https://www.paralect.com/skills/og-image) | A share card built from the product's real interface and wired into the meta tags |
| [og-image-animated](https://www.paralect.com/skills/og-image-animated) | A few-second reveal of the share card, as MP4 and GIF |
| [og-image-live](https://www.paralect.com/skills/og-image-live) | A 5 second share video where the product moves inside the card |
| [website-screenshot-reel](https://www.paralect.com/skills/website-screenshot-reel) | A GIF or MP4 slideshow of hero sections from a list of URLs |
| [website-scroll](https://www.paralect.com/skills/website-scroll) | A short MP4 of any public page scrolling the way a reader does, popups out of the way |
| [product-demo](https://www.paralect.com/skills/product-demo) | A ScreenStudio-style demo of the running app with a drawn cursor, as a square MP4 |

### Content and reports

| Skill | What it does |
| --- | --- |
| [article-image](https://www.paralect.com/skills/article-image) | The image that runs with a blog post, in one of 8 house styles |
| pulse-repo-stats | A one-file HTML dashboard of how a GitHub repo ships: release weeks, review wait, time to merge, AI agent share |

## What some skills need

| Skill | Needs |
| --- | --- |
| saas-logo | `OPENROUTER_API_KEY`, Python 3 (Pillow and NumPy install themselves on first run), `rsvg-convert` for contact sheets |
| og-image, og-image-animated, og-image-live, website-scroll, product-demo | Node and Playwright with Chromium, or your own Chrome |
| og-image-animated, og-image-live, website-screenshot-reel, website-scroll, product-demo | `ffmpeg` |
| pulse-repo-stats | Node 18+ and `gh auth login` or `GH_TOKEN`. Data stays on your computer |

## Run them without a terminal

[Paralect Agent](https://panel.paralect.com) lets you tick a skill as a task. Claude Code runs it on your project, on your machine, and reports back.

## License

MIT
