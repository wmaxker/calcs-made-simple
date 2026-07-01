/**
 * ad-engine.js  —  v2.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads ?app= from the URL, fetches ads/ad-control.json, and builds the
 * correct ad layout inside #sidebar-ad-container.
 *
 * SUPPORTED LAYOUT TYPES (adType)
 *   single-skyscraper  →  one 300×600 image linked to a URL
 *   dual-stacked       →  two 300×300 images (slotA / slotB) stacked vertically
 *
 * HOMEPAGE / STATIC PAGE RULE
 *   When ?app= is absent, or the value matches a non-calculator page key
 *   (see STATIC_PAGES below), the container is wiped and filled with a
 *   solid #f8fafc background — no imagery, no borders, no labels.
 *
 * HOST PAGE REQUIREMENT
 *   Place one element with the correct id in your dashboard markup:
 *     <div id="sidebar-ad-container"></div>
 *   Load this script with the defer attribute:
 *     <script src="ads/ad-engine.js" defer></script>
 *
 *   The host page must reserve the 300×600 column space in its own CSS.
 *   This engine only writes *inside* #sidebar-ad-container and has no
 *   other global side-effects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ─── Configuration ──────────────────────────────────────────────────────────*/

const CONFIG_URL      = 'ads/ad-control.json';
const CONTAINER_ID    = 'sidebar-ad-container';
const CONTAINER_W     = 300;
const CONTAINER_H     = 600;
const SLOT_H          = 300;   // height of each slot in dual-stacked mode
const HOMEPAGE_BG     = '#f8fafc';

/**
 * App parameter values that represent static, non-calculator pages.
 * The container reverts to the clean background fill for these routes
 * in addition to the no-parameter (homepage) state.
 */
const STATIC_PAGES = new Set(['contact', 'about', 'privacy', 'terms', 'welcome']);

/* ─── Bootstrap ──────────────────────────────────────────────────────────────*/

/**
 * Entry point — called automatically once the DOM is ready.
 */
async function initAdEngine() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn('[AdEngine] #sidebar-ad-container not found. Engine halted.');
    return;
  }

  applyContainerBase(container);

  const appParam = getAppParam();

  // ── Homepage / static page rule ───────────────────────────────────────────
  // No ?app= present, or the page is a known non-calculator destination.
  // Render a clean solid fill with nothing inside.
  if (!appParam || STATIC_PAGES.has(appParam)) {
    applyBlankState(container);
    return;
  }

  // ── Calculator page ───────────────────────────────────────────────────────
  let config;
  try {
    config = await fetchConfig();
  } catch (err) {
    console.error('[AdEngine] Could not load ad-control.json:', err);
    applyBlankState(container);  // Fail silently — never show broken UI.
    return;
  }

  const route = resolveRoute(appParam, config);
  renderAd(container, route, config.defaults || {});
}

/* ─── URL Utilities ──────────────────────────────────────────────────────────*/

/**
 * Returns the lowercase, trimmed value of ?app= or null when absent/empty.
 *
 * @returns {string|null}
 */
function getAppParam() {
  const val = new URLSearchParams(window.location.search).get('app');
  return (val && val.trim()) ? val.trim().toLowerCase() : null;
}

/* ─── Config Loader ──────────────────────────────────────────────────────────*/

/**
 * Fetches and parses ads/ad-control.json.
 * Always bypasses the browser cache so a freshly deployed config is
 * picked up immediately without a hard refresh.
 *
 * @returns {Promise<Object>}
 */
async function fetchConfig() {
  const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Returns the route object for appParam, or a safe fallback placeholder
 * if the route is not defined in the JSON.
 *
 * @param {string} appParam
 * @param {Object} config
 * @returns {Object}
 */
function resolveRoute(appParam, config) {
  const routes = config.routes || {};

  if (routes[appParam]) {
    return routes[appParam];
  }

  console.warn(`[AdEngine] No route for app="${appParam}". Falling back to defaults.`);
  const slot = config.defaults?.slot || {};
  return {
    adType:    'single-skyscraper',
    imagePath: slot.imagePath || '',
    linkUrl:   slot.linkUrl   || '#',
    alt:       slot.alt       || 'Advertisement'
  };
}

/* ─── Container Helpers ──────────────────────────────────────────────────────*/

/**
 * Locks the container to a fixed 300×600 footprint.
 * Called once before any content is written.
 *
 * @param {HTMLElement} container
 */
function applyContainerBase(container) {
  Object.assign(container.style, {
    width:      `${CONTAINER_W}px`,
    height:     `${CONTAINER_H}px`,
    overflow:   'hidden',
    position:   'relative',
    display:    'block',
    boxSizing:  'border-box',
    margin:     '0',
    padding:    '0',
    border:     'none',
    background: 'transparent'
  });
}

/**
 * Wipes the container and applies the clean solid background fill.
 * Used for the homepage, all static pages, and any error state.
 *
 * @param {HTMLElement} container
 */
function applyBlankState(container) {
  container.innerHTML        = '';
  container.style.background = HOMEPAGE_BG;
}

/* ─── Render Dispatcher ──────────────────────────────────────────────────────*/

/**
 * Reads adType from the resolved route and calls the correct layout builder.
 *
 * @param {HTMLElement} container
 * @param {Object}      route     — Resolved route block from ad-control.json.
 * @param {Object}      defaults  — The defaults block from ad-control.json.
 */
function renderAd(container, route, defaults) {
  // Clear any previous render before writing new content.
  container.innerHTML        = '';
  container.style.background = 'transparent';

  const adType = (route.adType || '').toLowerCase();

  switch (adType) {

    case 'single-skyscraper':
      renderSingleSkyscraper(container, route, defaults);
      break;

    case 'dual-stacked':
      renderDualStacked(container, route, defaults);
      break;

    default:
      console.warn(`[AdEngine] Unknown adType "${adType}". Applying blank state.`);
      applyBlankState(container);
      break;
  }
}

/* ─── Layout: Single Skyscraper ──────────────────────────────────────────────*/

/**
 * Injects a single 300×600 image wrapped in an anchor tag.
 *
 * Route shape expected:
 *   {
 *     "adType":    "single-skyscraper",
 *     "imagePath": "ads/placeholders/generic-default.png",
 *     "linkUrl":   "?app=contact",
 *     "alt":       "Advertisement"
 *   }
 *
 * @param {HTMLElement} container
 * @param {Object}      route
 * @param {Object}      defaults
 */
function renderSingleSkyscraper(container, route, defaults) {
  const slotDefaults = defaults.slot || {};

  const imagePath = (route.imagePath || slotDefaults.imagePath || '').trim();
  const linkUrl   = (route.linkUrl   || slotDefaults.linkUrl   || '#').trim();
  const alt       = (route.alt       || slotDefaults.alt       || 'Advertisement').trim();

  const anchor = buildAnchor(linkUrl);
  const img    = buildImage(imagePath, alt, CONTAINER_W, CONTAINER_H);

  anchor.appendChild(img);
  container.appendChild(anchor);
}

/* ─── Layout: Dual Stacked ───────────────────────────────────────────────────*/

/**
 * Programmatically builds two 300×300 square ad blocks stacked vertically,
 * with slotA on top and slotB on the bottom.
 *
 * Route shape expected:
 *   {
 *     "adType": "dual-stacked",
 *     "slotA": { "imagePath": "...", "linkUrl": "...", "alt": "..." },
 *     "slotB": { "imagePath": "...", "linkUrl": "...", "alt": "..." }
 *   }
 *
 * @param {HTMLElement} container
 * @param {Object}      route
 * @param {Object}      defaults
 */
function renderDualStacked(container, route, defaults) {
  const slotDefaults = defaults.slot || {};

  // Outer column — flex container that stacks the two slots with no gap.
  const stack = document.createElement('div');
  Object.assign(stack.style, {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'stretch',
    width:          `${CONTAINER_W}px`,
    height:         `${CONTAINER_H}px`,
    overflow:       'hidden',
    gap:            '0'
  });

  [route.slotA, route.slotB].forEach(function (slotCfg, index) {
    const cfg = slotCfg || {};

    const imagePath = (cfg.imagePath || slotDefaults.imagePath || '').trim();
    const linkUrl   = (cfg.linkUrl   || slotDefaults.linkUrl   || '#').trim();
    const alt       = (cfg.alt       || slotDefaults.alt       || 'Advertisement').trim();

    // Individual slot wrapper — fixed 300×300, cannot flex-shrink.
    const slotEl = document.createElement('div');
    Object.assign(slotEl.style, {
      width:      `${CONTAINER_W}px`,
      height:     `${SLOT_H}px`,
      overflow:   'hidden',
      flexShrink: '0',
      position:   'relative',
      display:    'block'
    });
    slotEl.dataset.adSlot = index === 0 ? 'a' : 'b';

    const anchor = buildAnchor(linkUrl);
    const img    = buildImage(imagePath, alt, CONTAINER_W, SLOT_H);

    anchor.appendChild(img);
    slotEl.appendChild(anchor);
    stack.appendChild(slotEl);
  });

  container.appendChild(stack);
}

/* ─── DOM Builder Helpers ────────────────────────────────────────────────────*/

/**
 * Returns a styled anchor element for the given URL.
 *
 * @param {string} href
 * @returns {HTMLAnchorElement}
 */
function buildAnchor(href) {
  const a    = document.createElement('a');
  a.href     = href;
  a.target   = '_blank';
  a.rel      = 'noopener noreferrer sponsored';
  Object.assign(a.style, {
    display:    'block',
    width:      '100%',
    height:     '100%',
    lineHeight: '0'
  });
  return a;
}

/**
 * Returns a styled image element sized to the given dimensions.
 * Hides itself silently if the image file is missing so the reserved
 * column space is preserved without showing a broken-image icon.
 *
 * @param {string} src
 * @param {string} alt
 * @param {number} w    — Width in pixels.
 * @param {number} h    — Height in pixels.
 * @returns {HTMLImageElement}
 */
function buildImage(src, alt, w, h) {
  const img    = document.createElement('img');
  img.src      = src;
  img.alt      = alt;
  img.width    = w;
  img.height   = h;
  img.draggable = false;
  Object.assign(img.style, {
    display:    'block',
    width:      '100%',
    height:     '100%',
    objectFit:  'cover',
    border:     'none'
  });

  img.onerror = function () {
    img.style.visibility = 'hidden';
    console.warn('[AdEngine] Image not found:', src);
  };

  return img;
}

/* ─── Init ───────────────────────────────────────────────────────────────────*/

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdEngine);
} else {
  initAdEngine();
}
