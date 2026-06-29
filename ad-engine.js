
/**
 * ad-engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Master ad rendering engine for the calculator suite.
 *
 * RESPONSIBILITIES
 *   1. Reads the active calculator from the URL query parameter (?app=).
 *   2. Fetches ads/ad-control.json to resolve the correct ad configuration.
 *   3. Applies the Homepage State Rule when no ?app= parameter is present.
 *   4. Delegates rendering to the correct handler for each lifecycle stage:
 *        placeholder   → static image, no interaction
 *        local_link    → static image wrapped in an anchor tag
 *        code_snippet  → third-party HTML loaded in a sandboxed iframe
 *        dual_stacked  → two independent 300×300 slots stacked in one container
 *
 * USAGE
 *   Place one element with id="ad-container" in your dashboard layout.
 *   Load this script with defer at the bottom of <body>:
 *     <div id="ad-container"></div>
 *     <script src="ads/ad-engine.js" defer></script>
 *
 * CONTAINER CONTRACT
 *   The host page is responsible for reserving the 300×600 column space.
 *   This engine only writes *inside* #ad-container — it does not alter
 *   any element outside it and has no global side-effects.
 *
 * CONFIG PATH
 *   Resolved relative to the page origin. If your repo root differs from
 *   the server root, update CONFIG_URL below.
 * ─────────────────────────────────────────────────────────────────────────────
 */
 
'use strict';
 
/* ─── Constants ─────────────────────────────────────────────────────────────── */
 
const CONFIG_URL      = 'ads/ad-control.json';
const CONTAINER_ID    = 'ad-container';
const CONTAINER_W     = 300;   // px — canonical ad column width
const CONTAINER_H     = 600;   // px — canonical ad column height
const SLOT_H_HALF     = 300;   // px — each slot height in dual_stacked mode
const HOMEPAGE_BG     = '#f8fafc';
 
/* ─── Bootstrap ─────────────────────────────────────────────────────────────── */
 
/**
 * Entry point. Runs after the DOM is ready (script loaded with defer).
 * Reads ?app= from the current URL, then branches into homepage or
 * calculator ad resolution.
 */
async function initAdEngine() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn('[AdEngine] No element with id="ad-container" found. Engine halted.');
    return;
  }
 
  // Lock the container to a fixed footprint so the host layout never reflows.
  applyContainerBase(container);
 
  const appParam = getAppParam();
 
  // ── Homepage State Rule ───────────────────────────────────────────────────
  // When no ?app= parameter is active the user is on the homepage.
  // Per spec: apply a solid background fill only — no labels, no borders,
  // no imagery. The container is intentionally invisible to the visitor.
  if (!appParam) {
    applyHomepageState(container);
    return;
  }
 
  // ── Calculator State ──────────────────────────────────────────────────────
  let config;
  try {
    config = await fetchConfig();
  } catch (err) {
    console.error('[AdEngine] Failed to load ad-control.json:', err);
    applyHomepageState(container); // Fail silently — show blank fill, not broken UI.
    return;
  }
 
  const routeConfig = resolveRoute(appParam, config);
  renderAd(container, routeConfig, config.defaults);
}
 
/* ─── URL Utilities ─────────────────────────────────────────────────────────── */
 
/**
 * Returns the value of the ?app= query parameter from the current URL,
 * or null if the parameter is absent or empty.
 * Example: ?app=aircraft  →  "aircraft"
 *
 * @returns {string|null}
 */
function getAppParam() {
  const params = new URLSearchParams(window.location.search);
  const val    = params.get('app');
  return (val && val.trim().length > 0) ? val.trim().toLowerCase() : null;
}
 
/* ─── Config Loader ─────────────────────────────────────────────────────────── */
 
/**
 * Fetches and parses ads/ad-control.json.
 * Throws on network error or non-200 response so the caller can handle it.
 *
 * @returns {Promise<Object>} Parsed JSON config object.
 */
async function fetchConfig() {
  const response = await fetch(CONFIG_URL, {
    // Prevent stale configs from persisting across deployments.
    cache: 'no-cache'
  });
 
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${CONFIG_URL}`);
  }
 
  return response.json();
}
 
/**
 * Resolves the ad configuration object for the active route.
 * Falls back to the defaults block if the route key is not found.
 *
 * @param {string} appParam  — Value of ?app= (e.g. "aircraft").
 * @param {Object} config    — Full parsed ad-control.json object.
 * @returns {Object}         — The route-level config block to render.
 */
function resolveRoute(appParam, config) {
  const routes = config.routes || {};
 
  if (routes[appParam]) {
    return routes[appParam];
  }
 
  // Unknown route — log and fall back gracefully.
  console.warn(`[AdEngine] No route found for app="${appParam}". Using default placeholder.`);
  return {
    type:        'placeholder',
    placeholder: config.defaults?.placeholder || { image: '', alt: 'Advertisement' }
  };
}
 
/* ─── Container Setup ───────────────────────────────────────────────────────── */
 
/**
 * Applies the fixed 300×600 footprint and base styles to the host container.
 * Called once before any content is rendered.
 *
 * @param {HTMLElement} container
 */
function applyContainerBase(container) {
  container.style.cssText = [
    `width: ${CONTAINER_W}px`,
    `height: ${CONTAINER_H}px`,
    'overflow: hidden',       // Hard clip — no ad content escapes the column.
    'position: relative',     // Stacking context for absolutely-positioned children.
    'display: block',
    'box-sizing: border-box',
    'margin: 0',
    'padding: 0',
    'border: none',
    'outline: none',
    'background: transparent'
  ].join('; ');
}
 
/* ─── Homepage State ────────────────────────────────────────────────────────── */
 
/**
 * Homepage State Rule implementation.
 * Fills the container with a solid background color.
 * No labels, no borders, no imagery are applied.
 *
 * @param {HTMLElement} container
 */
function applyHomepageState(container) {
  container.style.background = HOMEPAGE_BG;
  container.innerHTML = ''; // Ensure nothing else renders inside.
}
 
/* ─── Render Dispatcher ─────────────────────────────────────────────────────── */
 
/**
 * Reads the 'type' field of a route config and delegates to the
 * appropriate renderer. Unknown types fall back to placeholder.
 *
 * @param {HTMLElement} container
 * @param {Object}      routeConfig  — Resolved route block from ad-control.json.
 * @param {Object}      defaults     — The defaults block from ad-control.json.
 */
function renderAd(container, routeConfig, defaults) {
  const type = (routeConfig.type || 'placeholder').toLowerCase();
 
  switch (type) {
 
    case 'placeholder':
      renderPlaceholder(container, routeConfig.placeholder, defaults);
      break;
 
    case 'local_link':
      renderLocalLink(container, routeConfig.local_link);
      break;
 
    case 'code_snippet':
      renderCodeSnippet(container, routeConfig.code_snippet);
      break;
 
    case 'dual_stacked':
      renderDualStacked(container, routeConfig.dual_stacked, defaults);
      break;
 
    default:
      console.warn(`[AdEngine] Unknown ad type "${type}". Falling back to placeholder.`);
      renderPlaceholder(container, defaults?.placeholder, defaults);
      break;
  }
}
 
/* ─── Stage 1: Placeholder ──────────────────────────────────────────────────── */
 
/**
 * Renders a static local image with no interactivity.
 * Used at launch and during pre-sale periods.
 *
 * Expected config shape:
 *   { image: "ads/placeholders/aircraft-default.png", alt: "..." }
 *
 * @param {HTMLElement} container
 * @param {Object}      cfg       — The placeholder block from the route config.
 * @param {Object}      defaults  — Fallback values.
 */
function renderPlaceholder(container, cfg, defaults) {
  const fallback = defaults?.placeholder || {};
  const image    = (cfg?.image || fallback.image || '').trim();
  const alt      = (cfg?.alt   || fallback.alt   || 'Advertisement').trim();
 
  const img = document.createElement('img');
  img.src              = image;
  img.alt              = alt;
  img.width            = CONTAINER_W;
  img.height           = CONTAINER_H;
  img.style.cssText    = 'display:block; width:100%; height:100%; object-fit:cover; border:none;';
  img.draggable        = false;
 
  img.onerror = () => {
    // If the placeholder image itself is missing, hold the reserved space quietly.
    img.style.visibility = 'hidden';
    console.warn(`[AdEngine] Placeholder image not found: ${image}`);
  };
 
  container.innerHTML = '';
  container.appendChild(img);
}
 
/* ─── Stage 2: Local Link ───────────────────────────────────────────────────── */
 
/**
 * Renders a static local image wrapped in an anchor tag.
 * Used for direct-sold campaigns with a known click-through URL.
 *
 * Expected config shape:
 *   {
 *     image:  "ads/creatives/aircraft-campaign.png",
 *     alt:    "...",
 *     url:    "https://advertiser.com/landing",
 *     target: "_blank",
 *     rel:    "noopener noreferrer sponsored"
 *   }
 *
 * @param {HTMLElement} container
 * @param {Object}      cfg  — The local_link block from the route config.
 */
function renderLocalLink(container, cfg) {
  if (!cfg) {
    console.error('[AdEngine] local_link config block is missing.');
    return;
  }
 
  const anchor       = document.createElement('a');
  anchor.href        = cfg.url    || '#';
  anchor.target      = cfg.target || '_blank';
  anchor.rel         = cfg.rel    || 'noopener noreferrer sponsored';
  anchor.style.cssText = 'display:block; width:100%; height:100%; line-height:0;';
 
  const img          = document.createElement('img');
  img.src            = (cfg.image || '').trim();
  img.alt            = (cfg.alt   || 'Advertisement').trim();
  img.width          = CONTAINER_W;
  img.height         = CONTAINER_H;
  img.style.cssText  = 'display:block; width:100%; height:100%; object-fit:cover; border:none;';
  img.draggable      = false;
 
  img.onerror = () => {
    img.style.visibility = 'hidden';
    console.warn(`[AdEngine] local_link image not found: ${cfg.image}`);
  };
 
  anchor.appendChild(img);
  container.innerHTML = '';
  container.appendChild(anchor);
}
 
/* ─── Stage 3: Code Snippet ─────────────────────────────────────────────────── */
 
/**
 * Loads a third-party ad HTML file into a sandboxed iframe.
 * The iframe is strictly sized and isolated — it cannot access the parent
 * document's DOM, cookies, or globals beyond what the sandbox attribute allows.
 *
 * Expected config shape:
 *   {
 *     src:     "ads/sponsored-snippets/network-campaign.html",
 *     width:   300,
 *     height:  600,
 *     sandbox: "allow-scripts allow-same-origin allow-popups",
 *     label:   "Sponsored"
 *   }
 *
 * SAFETY NOTE
 *   The sandbox attribute is applied verbatim from the config. Ad-ops must
 *   not add "allow-same-origin" together with "allow-scripts" for untrusted
 *   cross-origin content — doing so grants the iframe the ability to remove
 *   its own sandbox. For network ads served from a different origin,
 *   use "allow-scripts allow-popups" only.
 *
 * @param {HTMLElement} container
 * @param {Object}      cfg  — The code_snippet block from the route config.
 */
function renderCodeSnippet(container, cfg) {
  if (!cfg || !cfg.src) {
    console.error('[AdEngine] code_snippet config block is missing or has no src.');
    return;
  }
 
  const w = cfg.width  || CONTAINER_W;
  const h = cfg.height || CONTAINER_H;
 
  // Optional "Sponsored" label rendered above the iframe.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    `width:${CONTAINER_W}px`,
    `height:${CONTAINER_H}px`,
    'overflow:hidden'
  ].join('; ');
 
  if (cfg.label) {
    const label = buildSponsoredLabel(cfg.label);
    // Reduce iframe height to fit label without overflowing the 600px column.
    wrapper.appendChild(label);
    const labelH  = 18; // px — matches the label's line-height below.
    const frameH  = Math.min(h, CONTAINER_H - labelH);
    appendIframe(wrapper, cfg.src, w, frameH, cfg.sandbox);
  } else {
    appendIframe(wrapper, cfg.src, w, Math.min(h, CONTAINER_H), cfg.sandbox);
  }
 
  container.innerHTML = '';
  container.appendChild(wrapper);
}
 
/**
 * Creates and appends a sandboxed iframe to a parent element.
 *
 * @param {HTMLElement} parent
 * @param {string}      src
 * @param {number}      w
 * @param {number}      h
 * @param {string}      sandboxAttr
 */
function appendIframe(parent, src, w, h, sandboxAttr) {
  const iframe              = document.createElement('iframe');
  iframe.src                = src;
  iframe.width              = w;
  iframe.height             = h;
  iframe.scrolling          = 'no';
  iframe.frameBorder        = '0';
  iframe.marginWidth        = '0';
  iframe.marginHeight       = '0';
  iframe.sandbox            = sandboxAttr || 'allow-scripts allow-popups';
  iframe.style.cssText      = [
    'display:block',
    'border:none',
    'overflow:hidden',
    `width:${w}px`,
    `height:${h}px`,
    'flex-shrink:0'
  ].join('; ');
 
  iframe.onerror = () => {
    console.warn(`[AdEngine] iframe failed to load: ${src}`);
  };
 
  parent.appendChild(iframe);
}
 
/* ─── Stage 4: Dual Stacked ─────────────────────────────────────────────────── */
 
/**
 * Renders two independent 300×300 ad slots stacked vertically inside the
 * single 300×600 container using a flexbox column layout.
 *
 * Each slot ("top" / "bottom") has its own type and config block, so slots
 * can be at different lifecycle stages independently.
 *
 * Expected config shape:
 *   {
 *     top:    { type: "local_link",  ... },
 *     bottom: { type: "code_snippet", ... }
 *   }
 *
 * @param {HTMLElement} container
 * @param {Object}      cfg       — The dual_stacked block from the route config.
 * @param {Object}      defaults  — Fallback values.
 */
function renderDualStacked(container, cfg, defaults) {
  if (!cfg || (!cfg.top && !cfg.bottom)) {
    console.error('[AdEngine] dual_stacked config block is missing top/bottom definitions.');
    return;
  }
 
  // Outer flex column — holds both slots flush, no gap.
  const stack = document.createElement('div');
  stack.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:stretch',
    `width:${CONTAINER_W}px`,
    `height:${CONTAINER_H}px`,
    'overflow:hidden',
    'gap:0'
  ].join('; ');
 
  const slots = [
    { key: 'top',    slotCfg: cfg.top    },
    { key: 'bottom', slotCfg: cfg.bottom }
  ];
 
  slots.forEach(({ key, slotCfg }) => {
    // Each slot gets its own fixed 300×300 host div.
    const slotEl = document.createElement('div');
    slotEl.dataset.adSlot = key;
    slotEl.style.cssText  = [
      `width:${CONTAINER_W}px`,
      `height:${SLOT_H_HALF}px`,
      'overflow:hidden',
      'flex-shrink:0',
      'position:relative'
    ].join('; ');
 
    if (!slotCfg) {
      // Slot defined in JSON but has no config — hold the space with the bg fill.
      slotEl.style.background = HOMEPAGE_BG;
      stack.appendChild(slotEl);
      return;
    }
 
    // Build a minimal synthetic config block that re-uses the shared renderers.
    // For code_snippet in dual_stacked, enforce 300×300 sizing.
    const normalised = normaliseDualSlotConfig(slotCfg, key);
    renderAd(slotEl, normalised, defaults);
    stack.appendChild(slotEl);
  });
 
  container.innerHTML = '';
  container.appendChild(stack);
}
 
/**
 * Normalises a dual_stacked slot config into the standard route config shape
 * expected by renderAd(). Ensures code_snippet slots are sized to 300×300.
 *
 * @param {Object} slotCfg  — The top or bottom config object.
 * @param {string} key      — "top" or "bottom" (used for logging only).
 * @returns {Object}        — A route-config-shaped object.
 */
function normaliseDualSlotConfig(slotCfg, key) {
  const type = (slotCfg.type || 'placeholder').toLowerCase();
 
  // For code_snippet slots, clamp width/height to the half-container size.
  if (type === 'code_snippet') {
    return {
      type: 'code_snippet',
      code_snippet: {
        ...slotCfg,
        width:  CONTAINER_W,
        height: SLOT_H_HALF
      }
    };
  }
 
  // placeholder, local_link — promote the flat slot config into the
  // standard nested shape (e.g. { type, placeholder: { image, alt } }).
  if (type === 'placeholder') {
    return {
      type: 'placeholder',
      placeholder: { image: slotCfg.image, alt: slotCfg.alt }
    };
  }
 
  if (type === 'local_link') {
    return {
      type: 'local_link',
      local_link: {
        image:  slotCfg.image,
        alt:    slotCfg.alt,
        url:    slotCfg.url,
        target: slotCfg.target,
        rel:    slotCfg.rel
      }
    };
  }
 
  // Unknown sub-type within dual_stacked.
  console.warn(`[AdEngine] Unknown dual_stacked slot type "${type}" for slot "${key}".`);
  return { type: 'placeholder', placeholder: {} };
}
 
/* ─── Shared UI Helpers ─────────────────────────────────────────────────────── */
 
/**
 * Builds a minimal "Sponsored" disclosure label element.
 * Styled to be visible but unobtrusive — no external classes required.
 *
 * @param {string} text  — Label text from config (e.g. "Sponsored").
 * @returns {HTMLElement}
 */
function buildSponsoredLabel(text) {
  const label           = document.createElement('div');
  label.textContent     = text;
  label.style.cssText   = [
    'display:block',
    'width:100%',
    'height:18px',
    'line-height:18px',
    'font-family:system-ui, sans-serif',
    'font-size:10px',
    'color:#9ca3af',
    'text-align:right',
    'padding:0 4px',
    'box-sizing:border-box',
    'flex-shrink:0',
    'user-select:none'
  ].join('; ');
  return label;
}
 
/* ─── Init ───────────────────────────────────────────────────────────────────── */
 
// Execute after the DOM is fully parsed. The <script defer> attribute on the
// host page guarantees this, but the DOMContentLoaded guard is kept as a
// safety net for any non-deferred inclusion.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdEngine);
} else {
  initAdEngine();
}
 
