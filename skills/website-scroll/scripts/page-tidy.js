// What gets out of the way of a clean scroll: cookie banners, consent dialogs,
// newsletter popups, chat launchers. `tidyPage` runs inside the page (the
// recorder evaluates it there), so it
// must stay self-contained: no imports, no references outside its own body.
// Regexes travel as { source, flags } and are rebuilt inside, since the function
// may cross a serialization boundary.

// Consent managers, cookie bars, chat launchers and the like, by the ids and
// classes they ship with. Hidden outright; matching is case-insensitive.
export const NOISE_SELECTORS = [
  "#onetrust-consent-sdk",
  "#onetrust-banner-sdk",
  ".onetrust-pc-dark-filter",
  "#CybotCookiebotDialog",
  "#CybotCookiebotDialogBodyUnderlay",
  "#usercentrics-root",
  "#usercentrics-cmp-ui",
  ".qc-cmp2-container",
  "#qc-cmp2-container",
  "#didomi-host",
  ".didomi-popup-backdrop",
  ".osano-cm-window",
  ".osano-cm-dialog",
  "#truste-consent-track",
  ".truste_overlay",
  ".truste_box_overlay",
  "#hs-eu-cookie-confirmation",
  "#hs-banner-parent",
  ".cc-window",
  ".cc-banner",
  ".cc-overlay",
  "#cookie-law-info-bar",
  "#cookie-notice",
  "#cookieConsent",
  "#cookie-consent",
  "#cookieBanner",
  "#cookie-banner",
  ".cookie-banner",
  ".cookie-consent",
  ".cookie-notice",
  ".cookie-bar",
  ".cookiebar",
  ".cookies-banner",
  ".cookie-popup",
  ".gdpr-banner",
  ".gdpr-consent",
  "#gdpr-banner",
  "#consent-banner",
  ".consent-banner",
  ".consent-modal",
  "[data-cookiebanner]",
  "[data-cookie-banner]",
  "[data-consent-banner]",
  "#iubenda-cs-banner",
  ".iubenda-cs-container",
  "#axeptio_overlay",
  "#cmpbox",
  "#cmpbox2",
  ".cmp-container",
  '[id^="sp_message_container"]',
  ".sp-message-open",
  "#termly-code-snippet-support",
  ".termly-styles-root",
  "#ketch-banner",
  "#ketch-root",
  ".ketch-consent",
  "#pandectes-banner",
  ".cky-consent-container",
  ".cky-overlay",
  ".cky-modal",
  "#cookiescript_injected",
  "#cookiescript_injected_wrapper",
  "#cookieyes",
  "#moove_gdpr_cookie_info_bar",
  ".moove-gdpr-info-bar-container",
  "#borlabs-cookie",
  ".BorlabsCookie",
  "#cookie-law-info-again",
  "#cc-main",
  ".cc-main",
  "#coiOverlay",
  ".coi-banner__wrapper",
  "#gdpr-cookie-message",
  "#privacy-banner",
  ".privacy-banner",
  "#privacy-notice",
  ".evidon-banner",
  "#_evidon_banner",
  "#ez-cookie-dialog",
  ".ez-cookie-dialog",
  // Chat launchers and support widgets.
  "#intercom-container",
  ".intercom-lightweight-app",
  ".intercom-launcher-frame",
  'iframe[name="intercom-launcher-frame"]',
  'iframe[name="intercom-notifications-frame"]',
  "#crisp-chatbox",
  ".crisp-client",
  "#hubspot-messages-iframe-container",
  "#drift-widget-container",
  "#drift-frame-controller",
  "#drift-frame-chat",
  'iframe[title="Drift Widget Chat Controller"]',
  "#tidio-chat",
  "#tidio-chat-iframe",
  "#launcher",
  'iframe[title*="Message from company"]',
  'iframe[title*="Close message"]',
  'iframe[title*="Button to launch messaging window"]',
  'iframe[title*="Chat widget"]',
  'iframe[id^="zsiq"]',
  ".zsiq_floatmain",
  "#chat-widget-container",
  "#livechat-wrapper",
  "#fb-root .fb_dialog",
  ".woot-widget-bubble",
  ".woot-widget-holder",
  "#tawkchat-container",
  'iframe[title="chat widget"]',
  ".gorgias-chat-container",
  "#gorgias-chat-container",
  "#front-chat-container",
  "#front-chat-holder",
  '[class*="olark"]',
  "#freshworks-container",
  "#fc_frame",
  "#pylon-chat-launcher",
  "#plain-chat-container",
  // Sticky promo bars and app nags.
  ".smartbanner",
  "#smartbanner",
  ".hellobar",
  "#hellobar-bar",
  ".sumome-popup-container",
  ".sumome-react-wysiwyg-popup-container",
  ".ml-form-embed",
  ".mailerlite-popup",
  ".klaviyo-form",
  '[class*="klaviyo-form"]',
  ".privy-popup-container",
  ".needsclick.kl-private-reset-css-Xuajs1",
  ".optinmonster",
  '[id^="om-"]',
  ".pushcrew-chrome-style-notification",
  "#onesignal-slidedown-container",
  ".onesignal-slidedown-container",
  "#onesignal-bell-container",
  "#nprogress",
];

// Text that marks an overlay as a cookie or consent notice, a newsletter
// popup or another nag, when the id or class doesn't already say so.
export const NOISE_TEXT =
  /\b(cookies?|consent|gdpr|privacy (policy|settings|preferences)|we use cookies|accept all|reject all|manage (preferences|cookies)|your privacy|subscribe to|newsletter|sign up for|join our|get \d+% off|special offer|limited time|don'?t miss|before you go|exit intent)\b/i;

// Buttons that dismiss a consent notice for the reader: tried first, so a
// site that remembers the choice looks the way it does after the first visit.
export const ACCEPT_TEXT =
  /^\s*(accept( all| cookies| all cookies| & close| and close)?|allow( all| cookies| all cookies)?|agree|i agree|i accept|got it|ok(ay)?|understood|i understand|yes,? i agree|continue|close|dismiss|no thanks|not now|maybe later|skip|✕|×)\s*[!.]?\s*$/i;

/** Runs in the page: hides what covers the content and frees the scroll. */
export function tidyPage({ noiseSelectors, noiseText, acceptText, viewport }) {
  const noise = new RegExp(noiseText.source, noiseText.flags);
  const accept = new RegExp(acceptText.source, acceptText.flags);
  const hidden = new Set();
  const hide = (el) => {
    if (
      !el ||
      hidden.has(el) ||
      el === document.body ||
      el === document.documentElement
    )
      return;
    hidden.add(el);
    // Already hidden on an earlier pass: no new attribute, so a mutation
    // observer that re-runs the tidy doesn't loop on its own changes.
    if (!el.hasAttribute("data-website-scroll-hidden")) {
      el.setAttribute("data-website-scroll-hidden", "");
    }
  };

  // 1. Known widgets, by selector.
  for (const selector of noiseSelectors) {
    let found;
    try {
      found = document.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of found) hide(el);
  }

  // 2. A consent notice that says so: click its accept button, then hide it.
  const clickable = [...document.querySelectorAll("button, [role=button], a")];
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0"
    );
  };
  let clicked = 0;
  for (const el of clickable) {
    if (clicked >= 3 || !visible(el)) continue;
    const label = (
      el.textContent ||
      el.getAttribute("aria-label") ||
      ""
    ).trim();
    if (!accept.test(label)) continue;
    // Only inside something that reads like a notice, never a page's own button.
    let box = el.parentElement;
    let depth = 0;
    let inNotice = false;
    while (box && depth < 8) {
      const text = (box.innerText || "").slice(0, 600);
      const style = getComputedStyle(box);
      if (
        (style.position === "fixed" || style.position === "sticky") &&
        (noise.test(text) || noise.test(box.id + " " + box.className))
      ) {
        inNotice = true;
        break;
      }
      box = box.parentElement;
      depth++;
    }
    if (inNotice) {
      try {
        el.click();
        clicked++;
      } catch {
        // not clickable after all
      }
    }
  }

  // 3. Anything fixed or sticky that covers the viewport or sits along an
  //    edge and reads like a notice, a dialog that opened on its own, and the
  //    backdrops behind them.
  const all = document.body ? document.body.querySelectorAll("*") : [];
  const area = viewport.width * viewport.height;
  for (const el of all) {
    if (hidden.has(el)) continue;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const cover = (rect.width * rect.height) / area;
    const text = (el.innerText || "").slice(0, 1200);
    const name = `${el.id} ${typeof el.className === "string" ? el.className : ""} ${el.getAttribute("aria-label") || ""}`;
    const role = el.getAttribute("role");
    const modal =
      el.getAttribute("aria-modal") === "true" ||
      role === "dialog" ||
      role === "alertdialog";
    const reads = noise.test(text) || noise.test(name);
    // A full-screen backdrop or scrim: translucent, covering nearly everything.
    const scrim =
      cover > 0.9 &&
      !text.trim() &&
      (parseFloat(style.opacity) < 1 ||
        /rgba?\(.*,\s*0?\.\d+\)/.test(style.backgroundColor) ||
        style.backdropFilter !== "none");
    const bottomBar =
      rect.bottom >= viewport.height - 2 &&
      rect.height < viewport.height * 0.45;
    const topBar =
      rect.top <= 2 &&
      rect.height < viewport.height * 0.25 &&
      rect.width > viewport.width * 0.6;
    const cornerBubble =
      rect.width < 120 &&
      rect.height < 120 &&
      rect.bottom > viewport.height - 160 &&
      !modal;
    if (
      scrim ||
      (modal && cover > 0.05) ||
      (reads && (bottomBar || topBar || cover > 0.2 || cornerBubble)) ||
      (cornerBubble && /chat|help|support|message|launcher|widget/i.test(name))
    ) {
      hide(el);
    }
  }

  // 4. What hiding leaves behind: a locked scroll and a blurred page.
  const free = {
    overflow: "visible",
    position: "static",
    filter: "none",
    "pointer-events": "auto",
  };
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    for (const [property, value] of Object.entries(free)) {
      // Sites re-lock the body (a consent manager, say); set again only
      // when needed, so the tidy can run on every DOM change.
      if (
        el.style.getPropertyValue(property) !== value ||
        el.style.getPropertyPriority(property) !== "important"
      ) {
        el.style.setProperty(property, value, "important");
      }
    }
  }
  document
    .querySelectorAll("[inert]")
    .forEach((el) => el.removeAttribute("inert"));

  return hidden.size + (clicked ? 1 : 0);
}

export const TIDY_CSS = `
  [data-website-scroll-hidden] { display: none !important; visibility: hidden !important; }
  html { scroll-behavior: auto !important; }
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none !important; caret-color: transparent !important; }
  html, body { overflow-y: visible !important; }
`;

/** The options as `tidyPage` takes them. */
export function tidyOptions(viewport) {
  return {
    noiseSelectors: NOISE_SELECTORS,
    noiseText: { source: NOISE_TEXT.source, flags: NOISE_TEXT.flags },
    acceptText: { source: ACCEPT_TEXT.source, flags: ACCEPT_TEXT.flags },
    viewport,
  };
}
