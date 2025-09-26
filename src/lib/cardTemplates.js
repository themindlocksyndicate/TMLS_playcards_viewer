import { loadDeck } from '../services/deckLoader.js';
import { pickDefaultDeck } from '../config/runtime.js';

/* ---------- SVG utils ---------- */
function parseSVG(svgText) {
  const p = new DOMParser();
  return p.parseFromString(svgText, 'image/svg+xml');
}
function serializeSVG(doc) {
  return new XMLSerializer().serializeToString(doc.documentElement);
}
function setTextById(doc, id, value) {
  const el = doc.getElementById(id);
  if (!el) return false;
  el.textContent = value ?? '';
  return true;
}
function setImageHrefById(doc, id, href) {
  if (!href) return false;
  const el = doc.getElementById(id);
  if (!el) return false;
  const isImage = el.tagName.toLowerCase() === 'image';
  if (isImage) {
    el.setAttribute('href', href);
  } else {
    while (el.firstChild) el.removeChild(el.firstChild);
    const img = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('href', href);
    img.setAttribute('width', el.getAttribute('width') || '100%');
    img.setAttribute('height', el.getAttribute('height') || '100%');
    el.appendChild(img);
  }
  return true;
}
function applyScaleToId(doc, id, scale) {
  if (!scale && scale !== 0) return false;
  const el = doc.getElementById(id);
  if (!el) return false;
  el.setAttribute('transform', `scale(${Number(scale)})`);
  return true;
}

/* ---------- Core deck-aware renderers ---------- */
async function renderSideSVG(card, sideKey, opts = {}) {
  const deckId = opts.deckId || card.deck || pickDefaultDeck();
  const deck = await loadDeck(deckId);
  if (!deck) return ''; // no broken render
  const { config, templates, base } = deck;
  const sideCfg = config?.[sideKey] || {};
  const svgText = sideKey === 'front' ? templates.front : templates.back;
  const doc = parseSVG(svgText);

  const cardSide = (card && card[sideKey]) || {};
  for (const [field, map] of Object.entries(sideCfg.text || {})) {
    const val = cardSide[field];
    setTextById(doc, map.slot, val ?? '');
  }

  for (const g of sideCfg.graphics || []) {
    const perCard = cardSide.graphics?.[g.source];
    const def = config?.defaults?.graphics?.[g.source];
    const href = perCard
      ? `${base}/${perCard}`
      : def
      ? `${base}/${def}`
      : g.fallback
      ? '/templates/logo.svg'
      : null;
    setImageHrefById(doc, g.slot, href);
  }

  const scale = cardSide.logoScale ?? card.logoScale ?? config?.defaults?.logoScale;
  if (sideCfg.logoScaleSlot) applyScaleToId(doc, sideCfg.logoScaleSlot, scale);

  return serializeSVG(doc);
}

export function renderFrontSVG(card, opts = {}) {
  return renderSideSVG(card, 'front', opts);
}
export function renderBackSVG(card, opts = {}) {
  return renderSideSVG(card, 'back', opts);
}

/* ---------- Compat exports (safe no-ops) ---------- */
export const cardTemplates = { front: {}, back: {} };
export function orderedHints() { return []; }
export async function loadTemplates() { /* deck-aware now; kept for compat callers */ }

export default { renderFrontSVG, renderBackSVG, cardTemplates, orderedHints, loadTemplates };
