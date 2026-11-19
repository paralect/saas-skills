// Screen recording kit for narrated feature videos: frames come from Chrome's screencast (sharp, at device pixels),
// a drawn cursor follows the mouse, moves are eased like a hand, and recording can pause for a deliberate cut.
// No Playwright import here: the take script brings its own playwright-core; this file only needs node + ffmpeg.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// The arrow cursor, drawn in the page (headless Chrome has none). Pass to context.addInitScript().
export const CURSOR_SCRIPT = () => {
  const add = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1.5 1.5v23.2l5.6-5.3 3.6 8.4 3.9-1.7-3.6-8.3h7.7z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {
      position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none',
      transform: `translate(${window.__cx ?? -50}px, ${window.__cy ?? -50}px)`,
    });
    // Only the arrow shrinks on press: scaling the moved element would scale its position too (a jump).
    Object.assign(c.firstChild.style, { display: 'block', transformOrigin: '2px 2px', transition: 'transform .08s' });
    document.documentElement.appendChild(c);
    raise();
  };
  // A modal <dialog> sits in the browser's top layer, above any z-index: the cursor is a popover so it can be there
  // too, and goes back on top every time a dialog opens (the newest top-layer element wins).
  const raise = () => {
    const c = document.getElementById('__cursor'); if (!c || !c.showPopover) return;
    try {
      if (!c.popover) { c.popover = 'manual'; Object.assign(c.style, { inset: '0 auto auto 0', margin: '0', padding: '0', border: '0', background: 'transparent', overflow: 'visible' }); }
      if (c.matches(':popover-open')) c.hidePopover();
      c.showPopover();
    } catch {}
  };
  if (window.HTMLDialogElement) {
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function (...a) { show.apply(this, a); raise(); };
  }
  document.addEventListener('mousemove', (e) => {
    window.__cx = e.clientX; window.__cy = e.clientY;
    const c = document.getElementById('__cursor'); if (c) c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  }, true);
  document.addEventListener('mousedown', () => { const c = document.getElementById('__cursor'); if (c) c.firstChild.style.transform = 'scale(0.85)'; }, true);
  document.addEventListener('mouseup', () => { const c = document.getElementById('__cursor'); if (c) c.firstChild.style.transform = ''; }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  new MutationObserver(add).observe(document.documentElement, { childList: true });
};

// Privacy + tidiness, as an init script: blurs every text node matching `blur` (phones, emails), blurs inputs
// matching `blurInputs` (CSS selectors), hides the smallest block that starts with one of `hide` (regex sources), and adds
// `css` as a stylesheet: the way to hide ads, cookie/survey banners and web components (text inside a shadow root is
// out of reach of the text walk; hide the host element by its tag). Find the tags with a probe run: an ad's wrapper often
// keeps its height after the ad is hidden, so hide the wrapper too and check the first frame for an empty band.
// Usage: await ctx.addInitScript(MASK_SCRIPT, { blur: ['\\(\\d{3}\\) \\d{3}-\\d{4}', '@example\\.com'], blurInputs: ['input[type=tel]'], hide: ['^Some banner text'], css: '.ad-slot, .ad-slot-wrapper { display:none!important }' });
export const MASK_SCRIPT = ({ blur = [], blurInputs = [], hide = [], css = '' } = {}) => {
  const blurRe = blur.length ? new RegExp(blur.join('|')) : null;
  const hideRes = hide.map((h) => new RegExp(h));
  const len = (e) => e.textContent.trim().length;
  const pass = () => {
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue; const el = n.parentElement; if (!el) continue;
      if (blurRe && blurRe.test(t) && el.style.filter !== 'blur(7px)') el.style.filter = 'blur(7px)';
      if (hideRes.some((r) => r.test(t.trim()))) {
        let b = el; // climb through wrappers that add almost no text of their own
        while (b.parentElement && b.parentElement !== document.body && len(b.parentElement) <= len(b) + 5) b = b.parentElement;
        if (b.style.display !== 'none') b.style.display = 'none';
      }
    }
    for (const s of blurInputs) document.querySelectorAll(s).forEach((e) => { if (e.style.filter !== 'blur(7px)') e.style.filter = 'blur(7px)'; });
  };
  const start = () => {
    if (css) { const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st); }
    pass(); new MutationObserver(pass).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
};

// Answers a request with the real response, edited: (text) => text. Drops the length/encoding headers the edit breaks.
// Usage: await ctx.route(/api\.example\.com\/users\/current/, (r) => rewrite(r, (t) => t.replaceAll(' (TEST)', '')));
export const rewrite = async (route, edit) => {
  const res = await route.fetch();
  const headers = { ...res.headers() }; delete headers['content-length']; delete headers['content-encoding'];
  return route.fulfill({ status: res.status(), headers, body: edit(await res.text()) });
};
export const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export class Recorder {
  constructor(dir) { this.ends = {}; this.dir = dir; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); this.frames = []; this.n = 0; this.marks = []; }

  // A named moment ("search opens"), put on the video's clock by encode(): time the voice lines from these.
  mark(label) {
    this.marks.push({ label, t: Date.now() / 1000, seg: this.seg });
    if (this.probe && this.page) {
      const f = `${this.pdir}/${String(this.marks.length).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '-')}.png`;
      return this.page.screenshot({ path: f }).then(() => console.log(`probe: ${f}`));
    }
    return Promise.resolve();
  }

  // NFV_PROBE=1 runs the take without recording: every mark() saves a full-size screenshot instead
  // (<dir>-probe/NN-<label>.png). Use it to look at the real screens before writing beats, and for the cover.
  get probe() { return !!process.env.NFV_PROBE; }

  async attach(page) {
    this.page = page;
    if (this.probe) { this.pdir = `${this.dir}-probe`; fs.rmSync(this.pdir, { recursive: true, force: true }); fs.mkdirSync(this.pdir, { recursive: true }); return; }
    this.cdp = await page.context().newCDPSession(page);
    this.cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      if (!this.on) return;
      const file = `${process.cwd()}/${this.dir}/f${String(this.n++).padStart(5, '0')}.jpg`;
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      this.frames.push({ file, t: metadata.timestamp, seg: this.seg });
    });
    this.seg = (this.seg ?? -1) + 1;
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 2520, maxHeight: 1080, everyNthFrame: 1 });
    await this.fresh();
  }

  // Chrome's screencast first re-sends an old frame (the page before your last scroll), then sends nothing until
  // something repaints: ignore frames for a moment, then force one repaint, so the take opens on the page as it is.
  async fresh() {
    this.on = false;
    await this.hold(400);
    this.on = true;
    await this.page.evaluate(() => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;background:rgba(0,0,0,.01);z-index:2147483646;pointer-events:none';
      document.documentElement.appendChild(d); setTimeout(() => d.remove(), 120);
    }).catch(() => {});
    await this.hold(150);
  }

  // A deliberate cut: frames stop until resume(h.park()). Use for page loads/navigation the viewer needn't watch.
  pause() { if (this.probe) return; this.ends[this.seg] = Date.now() / 1000; this.on = false; }
  // Restarts the screencast too (a cross-site trip stops it); its first frame is the page as it is now.
  // Pass the cursor's spot (h.park()) after a navigation: the new page has no drawn cursor until the mouse moves, so
  // this puts it back where it was, while still off camera.
  async resume(at) {
    if (at) await this.page.mouse.move(...at);
    if (this.probe) return;
    this.seg += 1;
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 2520, maxHeight: 1080, everyNthFrame: 1 });
    await this.fresh();
  }
  async detach() { if (this.probe) return; if (this.on) this.ends[this.seg] = Date.now() / 1000; this.on = false; await this.cdp.send('Page.stopScreencast').catch(() => {}); }
  hold(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Frames to MP4 at 30 fps: each frame lasts until the next one; a cut joins segments with no gap.
  // A still frame lasts at most 1.2 s, so loading waits shrink and a slow server never freezes the video. That also
  // means holding still longer than 1.2 s adds no video time: lengthen a beat with movement (another hover), not waits.
  // Returns the marks on the video's clock and writes them to <out>.marks.json; time the voiceover from those.
  encode(out) {
    if (this.probe) { console.log(`probe run: screenshots in ${this.pdir}, no video`); return []; }
    const lines = []; const at = []; let total = 0;
    const dur = (i) => {
      const f = this.frames[i]; const next = this.frames[i + 1];
      return next && next.seg === f.seg ? Math.min(next.t - f.t, 1.2) : Math.max((this.ends[f.seg] ?? f.t) - f.t, 1 / 30);
    };
    for (let i = 0; i < this.frames.length; i += 1) {
      const d = dur(i); at.push(total); total += d;
      lines.push(`file '${this.frames[i].file}'`, `duration ${d.toFixed(4)}`);
    }
    lines.push(`file '${this.frames.at(-1).file}'`); // concat needs it for the last duration; -t below drops the extra
    fs.writeFileSync(`${this.dir}/list.txt`, lines.join('\n'));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${this.dir}/list.txt`,
      '-vf', 'scale=2520:1080:force_original_aspect_ratio=decrease,pad=2520:1080:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p',
      '-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out]);
    // A mark sits in the last frame shown at that moment, in its own segment, at most that frame's duration in.
    const marks = this.marks.map(({ label, t, seg }) => {
      let i = -1;
      for (let j = 0; j < this.frames.length; j += 1) if (this.frames[j].seg === seg && this.frames[j].t <= t) i = j;
      if (i < 0) i = this.frames.findIndex((f) => f.seg === seg);
      const v = i < 0 ? 0 : at[i] + Math.min(Math.max(t - this.frames[i].t, 0), dur(i));
      return { label, video: +v.toFixed(2) };
    });
    fs.writeFileSync(`${out}.marks.json`, JSON.stringify({ duration: +total.toFixed(2), marks }, null, 1));
    console.log(`encoded ${out} (${total.toFixed(1)}s)`);
    for (const m of marks) console.log(`  ${m.video.toFixed(1).padStart(5)}s  ${m.label}`);
    return marks;
  }
}

// A hand on the mouse. The ONLY way the cursor moves during a take: never call page.mouse.move/wheel yourself
// (the drawn cursor would teleport). `start` is where the cursor already is, so a cut never jumps it.
// Every target must already be on screen: center() refuses an off-screen target instead of letting the page jump to
// it (an instant scroll reads as a cut). Bring it in first with h.scrollTo(loc) or h.scroll(dy).
export const moves = []; // [epoch s, x, y] of every cursor step: check-video.sh reads it for jumps, and for timing
export const human = (page, start = [840, 360]) => {
  let [x, y] = start;
  moves.push([Date.now() / 1000, x, y, 'start']);
  const ease = (t) => (1 - Math.cos(Math.PI * t)) / 2; // sine in-out
  const moveTo = async (tx, ty) => {
    const dx = tx - x; const dy = ty - y; const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const ms = Math.min(1400, 450 + dist * 0.75);
    const bow = Math.min(22, dist * 0.05); // one gentle bend, like a wrist
    const nx = -dy / dist; const ny = dx / dist;
    const t0 = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - t0) / ms);
      const k = ease(t); const arc = Math.sin(Math.PI * k) * bow;
      const px = x + dx * k + nx * arc; const py = y + dy * k + ny * arc;
      await page.mouse.move(px, py); moves.push([Date.now() / 1000, px, py]);
      if (t >= 1) break;
      await page.waitForTimeout(12);
    }
    x = tx; y = ty;
  };
  const center = async (loc, mid = false) => {
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    const b = await loc.boundingBox();
    const vp = page.viewportSize();
    if (!b || b.y < 0 || b.y + b.height > vp.height || b.x < 0 || b.x + b.width > vp.width) {
      await page.screenshot({ path: 'fail-offscreen.png' });
      throw new Error(`target is off screen, scroll to it first (h.scrollTo): ${loc}`);
    }
    return [b.x + (mid ? b.width / 2 : Math.min(b.width / 2, 60)), b.y + b.height / 2];
  };
  const h = {
    moveTo,
    async hover(loc, wait = 250, mid = false) { const [cx, cy] = await center(loc, mid); await moveTo(cx, cy); await page.waitForTimeout(wait); },
    async click(loc, wait = 600, mid = false) {
      const [cx, cy] = await center(loc, mid); await moveTo(cx, cy); await page.waitForTimeout(180);
      await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); await page.waitForTimeout(wait);
    },
    async type(text, delay = 45) { await page.keyboard.type(text, { delay }); },
    // A smooth wheel scroll by dy px. The wheel scrolls whatever is under the cursor: hover inside the scrollable
    // area (a dialog's body, a side panel) first, or the page behind it scrolls instead.
    async scroll(dy, ms = 900) {
      const steps = Math.round(ms / 16); let done = 0;
      for (let i = 1; i <= steps; i += 1) { const to = Math.round(dy * ease(i / steps)); await page.mouse.wheel(0, to - done); done = to; await page.waitForTimeout(16); }
      await page.waitForTimeout(300);
    },
    // Smooth-scrolls so the element's top lands `top` px from the viewport top.
    async scrollTo(loc, top = 200, ms = 1100) {
      const y = await loc.evaluate((el) => el.getBoundingClientRect().top);
      if (Math.abs(y - top) > 4) await h.scroll(Math.round(y - top), ms);
    },
    park: () => [x, y],
  };
  return h;
};

// Before attach(): put the page where the take starts, instantly, and let it settle. Scrolling after attach()
// shows as a jump in the first second.
export const settle = async (page, loc, block = 'center') => {
  if (loc) await loc.evaluate((el, b) => el.scrollIntoView({ block: b, behavior: 'instant' }), block);
  await page.waitForTimeout(1500);
};
