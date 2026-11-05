---
name: website-screenshot-reel
description: "Create a crisp animated GIF, MOV or MP4 slideshow of website hero sections (above-the-fold screenshots) from a list of URLs. Hides cookie banners, waits for pages to fully load, captures at 2x (Retina) resolution. Use when the user asks for a GIF/video/reel/slideshow/montage of screenshots of several websites, landing pages, or hero sections."
---

# Website Screenshot Reel

Every file this skill uses ships in its own folder, next to this SKILL.md, and paths here are relative to that folder. It needs nothing from other skills or other folders, so don't go looking for them. Unless the user names another place, save everything it makes in `out/website-screenshot-reel/` under the current project.

Turns a list of websites into a high-quality GIF or MOV with one slide per site's hero section.

## Defaults
- Viewport 1440×900, captured at 2× → output 2880×1800
- **1 second per slide**, loops forever (GIF)
- Tries to click "Accept" on cookie banners, then hides common consent popups with CSS
- Waits for load + network idle + fonts + images, nudges scroll for lazy media, then waits 12s for hero animations

## Steps

1. Collect the URLs (add `https://` if missing) and the output format. Default to GIF unless the user asks for a video (`.mov` / `.mp4`). Save output in `out/website-screenshot-reel/` unless told otherwise.
2. Run the script (it installs Playwright on first run; needs `ffmpeg` on PATH — `brew install ffmpeg` if missing):

   ```bash
   node <this skill folder>/scripts/reel.mjs \
     --out out/website-screenshot-reel/hero-sections.gif --shots out/website-screenshot-reel/hero-screenshots \
     https://example.com https://another.com
   ```

   Options:
   | Flag | Default | Meaning |
   |---|---|---|
   | `--out` | `out/website-screenshot-reel/reel.gif` | Output file; `.gif`, `.mov` or `.mp4` |
   | `--duration` | `1` | Seconds per slide |
   | `--width` / `--height` | `1440` / `900` | Browser viewport (CSS px) |
   | `--scale` | `2` | Device pixel ratio (2 = Retina-sharp) |
   | `--out-width` | viewport×scale | Output width in px (lanczos downscale). Use `1440` for a smaller file |
   | `--wait` | `12` | Extra seconds to wait after load for animations |
   | `--fps` | `30` | Frame rate for MOV/MP4 |
   | `--shots` | (temp) | Keep the individual PNG screenshots in this folder |

3. **Verify every screenshot** by reading the PNGs from `--shots` (always pass `--shots` so you can check them). Look for:
   - cookie/consent banners still visible
   - blurry/placeholder images, empty areas, loaders or skeletons (page not ready)
   - bot-protection / captcha pages
   If a site looks wrong, re-run just that site with a higher `--wait` (e.g. 20) into a separate folder, or adjust manually, then rebuild with all URLs. If a banner survives, write a one-off Playwright tweak rather than giving up.
4. Report the output path, size (`ls -la`), dimensions, slide count and anything that couldn't be fixed (e.g. chat widgets or announcement bars that are part of the page).

## Quality notes (why it looks crisp)
- Never capture at 1× and scale down — text blurs. Capture at 2× and keep full width, or downscale with lanczos.
- GIF uses a **per-frame 256-color palette** (`palettegen=stats_mode=single` + `paletteuse=new=1`) and a fine Bayer dither, so each site keeps its own colors with clean gradients and no grain.
- MOV/MP4 uses H.264 `crf 12`, `-tune stillimage`, `yuv420p` for QuickTime/Slack/web compatibility.
- A 5-site GIF at 2880px is ~2–3 MB; `--out-width 1440` gives ~1 MB.
