'use strict';
const CONFIG_URL = 'ads/ad-control.json';
const CONTAINER_ID = 'sidebar-ad-container';
const CONTAINER_W = 300;
const CONTAINER_H = 600;
const SLOT_H = 300;
const HOMEPAGE_BG = '#f8fafc';
const STATIC_PAGES = new Set(['contact', 'about', 'privacy', 'terms', 'welcome']);

// Sandbox policy for advertiser-supplied rawHtml/JS creatives.
// Deliberately omits "allow-same-origin" so third-party markup can render,
// animate, and click out, but cannot read this page's cookies/localStorage,
// touch the parent DOM, or make same-origin requests.
const RAW_HTML_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

async function initAdEngine() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) { console.warn('[AdEngine] #sidebar-ad-container not found.'); return; }
  applyContainerBase(container);
  const appParam = getAppParam();
  if (!appParam || STATIC_PAGES.has(appParam)) { applyBlankState(container); return; }
  let config;
  try { config = await fetchConfig(); } catch (err) { console.error('[AdEngine] Error:', err); applyBlankState(container); return; }
  const route = resolveRoute(appParam, config);
  renderAd(container, route, config.defaults || {});
}

function getAppParam() {
  const val = new URLSearchParams(window.location.search).get('app');
  return (val && val.trim()) ? val.trim().toLowerCase() : null;
}

async function fetchConfig() {
  const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Resolves a short URL slug (?app=aircraft) to its full route config.
// Lookup order: slugMap dictionary -> literal routes key -> defaults fallback.
function resolveRoute(appParam, config) {
  const slugMap = config.slugMap || {};
  const routes = config.routes || {};

  const mappedKey = slugMap[appParam];
  if (mappedKey && routes[mappedKey]) {
    return routes[mappedKey];
  }

  if (routes[appParam]) {
    return routes[appParam];
  }

  console.warn(`[AdEngine] No route for app="${appParam}". Falling back to defaults.`);
  const slot = config.defaults?.slot || {};
  return { adType: 'single-skyscraper', imagePath: slot.imagePath || '', linkUrl: slot.linkUrl || '#', alt: slot.alt || 'Advertisement' };
}

function applyContainerBase(container) {
  Object.assign(container.style, { width: `${CONTAINER_W}px`, height: `${CONTAINER_H}px`, overflow: 'hidden', position: 'relative', display: 'block', boxSizing: 'border-box', margin: '0', padding: '0', border: 'none', background: 'transparent' });
}

function applyBlankState(container) {
  container.innerHTML = '';
  container.style.background = HOMEPAGE_BG;
}

function renderAd(container, route, defaults) {
  container.innerHTML = '';
  container.style.background = 'transparent';
  const adType = (route.adType || '').toLowerCase();
  switch (adType) {
    case 'single-skyscraper': renderSingleSkyscraper(container, route, defaults); break;
    case 'dual-stacked': renderDualStacked(container, route, defaults); break;
    default: console.warn(`[AdEngine] Unknown type.`); applyBlankState(container); break;
  }
}

// Builds the visual content for one slot: a sandboxed iframe if rawHtml is
// present, otherwise the standard anchor/image pairing.
function buildSlotContent(cfg, slotDefaults, w, h) {
  const rawHtml = typeof cfg.rawHtml === 'string' ? cfg.rawHtml.trim() : '';
  if (rawHtml) {
    return buildRawHtmlFrame(rawHtml, w, h);
  }
  const imagePath = (cfg.imagePath || slotDefaults.imagePath || '').trim();
  const linkUrl = (cfg.linkUrl || slotDefaults.linkUrl || '#').trim();
  const alt = (cfg.alt || slotDefaults.alt || 'Advertisement').trim();
  const anchor = buildAnchor(linkUrl);
  const img = buildImage(imagePath, alt, w, h);
  anchor.appendChild(img);
  return anchor;
}

function renderSingleSkyscraper(container, route, defaults) {
  const slotDefaults = defaults.slot || {};
  const content = buildSlotContent(route, slotDefaults, CONTAINER_W, CONTAINER_H);
  container.appendChild(content);
}

function renderDualStacked(container, route, defaults) {
  const slotDefaults = defaults.slot || {};
  const stack = document.createElement('div');
  Object.assign(stack.style, { display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: `${CONTAINER_W}px`, height: `${CONTAINER_H}px`, overflow: 'hidden', gap: '0' });

  [route.slotA, route.slotB].forEach(function (slotCfg, index) {
    const cfg = slotCfg || {};
    const slotEl = document.createElement('div');
    Object.assign(slotEl.style, { width: `${CONTAINER_W}px`, height: `${SLOT_H}px`, overflow: 'hidden', flexShrink: '0', position: 'relative', display: 'block' });
    slotEl.dataset.adSlot = index === 0 ? 'a' : 'b';

    // Each slot is resolved independently so slotA can be a raw code
    // snippet while slotB is a plain image, or vice versa.
    const content = buildSlotContent(cfg, slotDefaults, CONTAINER_W, SLOT_H);
    slotEl.appendChild(content);
    stack.appendChild(slotEl);
  });

  container.appendChild(stack);
}

function buildAnchor(href) {
  const a = document.createElement('a');
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer sponsored';
  Object.assign(a.style, { display: 'block', width: '100%', height: '100%', lineHeight: '0' });
  return a;
}

function buildImage(src, alt, w, h) {
  const img = document.createElement('img');
  img.src = src; img.alt = alt; img.width = w; img.height = h; img.draggable = false;
  Object.assign(img.style, { display: 'block', width: '100%', height: '100%', objectFit: 'cover', border: 'none' });
  img.onerror = function () { img.style.visibility = 'hidden'; console.warn('Image missing:', src); };
  return img;
}

// Renders an advertiser rawHtml/JS snippet inside a sandboxed iframe via
// srcdoc, isolating it from the host page's DOM, cookies, and storage.
function buildRawHtmlFrame(rawHtml, w, h) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', RAW_HTML_SANDBOX);
  iframe.setAttribute('scrolling', 'no');
  iframe.title = 'Advertisement';
  iframe.width = w;
  iframe.height = h;
  Object.assign(iframe.style, { display: 'block', width: '100%', height: '100%', border: 'none', overflow: 'hidden' });
  iframe.srcdoc = rawHtml;
  return iframe;
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initAdEngine); } else { initAdEngine(); }
