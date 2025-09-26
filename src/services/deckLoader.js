import { DATASET_BASE, IS_DEV } from '../config/runtime.js';

const cache = new Map(); // deckId -> { base, config, cards, templates:{front,back}, valid:true }

/** Internal: fetch helpers */
async function getJSON(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); }
async function getText(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.text(); }

/** Validate a deck's templates + mappings + required fields. Returns an array of errors (empty if ok). */
export function validateDeck(deck) {
  const errors = [];
  const { config, templates, cards } = deck;
  if (!config) { errors.push('missing deck.config.json'); return errors; }
  if (!templates?.front) errors.push('missing templates/front.svg');
  if (!templates?.back)  errors.push('missing templates/back.svg');

  const parser = new DOMParser();
  const frontDoc = templates.front ? parser.parseFromString(templates.front, 'image/svg+xml') : null;
  const backDoc  = templates.back  ? parser.parseFromString(templates.back,  'image/svg+xml') : null;

  const hasId = (doc, id) => !!doc?.getElementById(id);

  for (const [sideKey, sideCfg] of Object.entries({ front: config.front, back: config.back })) {
    const doc = sideKey === 'front' ? frontDoc : backDoc;
    if (!doc) continue;
    for (const [, map] of Object.entries(sideCfg?.text || {})) {
      if (!hasId(doc, map.slot)) errors.push(`template:${sideKey} missing text slot "${map.slot}"`);
    }
    for (const g of sideCfg?.graphics || []) {
      if (!hasId(doc, g.slot)) errors.push(`template:${sideKey} missing graphic slot "${g.slot}"`);
    }
  }

  for (const card of cards?.cards || []) {
    for (const [field, map] of Object.entries(deck.config.front?.text || {})) {
      if (!map.optional && (card.front?.[field] == null)) errors.push(`card ${card.code || '?'} missing front.${field}`);
    }
    for (const [field, map] of Object.entries(deck.config.back?.text || {})) {
      if (!map.optional && (card.back?.[field] == null)) errors.push(`card ${card.code || '?'} missing back.${field}`);
    }
  }

  return errors;
}

/** Preferred base is the remote dataset repo; fallback to local /decks */
function bases() {
  return [
    `${DATASET_BASE}`, // remote root (has /index.json and /<id>/...)
    '/decks'           // local fallback
  ];
}

/** Load a deck by id (returns null if invalid or failed). */
export async function loadDeck(deckId = 'tmls-classic') {
  if (cache.has(deckId)) return cache.get(deckId);

  for (const baseRoot of bases()) {
    const base = `${baseRoot}/${deckId}`;
    try {
      const [config, cards, front, back] = await Promise.all([
        getJSON(`${base}/deck.config.json`),
        getJSON(`${base}/cards.json`).catch(() => ({ deck: deckId, cards: [] })),
        getText(`${base}/templates/front.svg`),
        getText(`${base}/templates/back.svg`),
      ]);

      const deck = { base, config, cards, templates: { front, back } };
      const errs = validateDeck(deck);
      if (errs.length) {
        if (IS_DEV) console.warn(`[deck:${deckId}] invalid:`, errs);
        continue; // try next base
      }
      const ok = { ...deck, valid: true };
      cache.set(deckId, ok);
      return ok;
    } catch (e) {
      if (IS_DEV) console.warn(`[deck:${deckId}] load failed from ${base}:`, e?.message || e);
      continue;
    }
  }

  return null;
}

/** Auto-list decks from remote /index.json first, fallback to local. Only return valid. */
export async function listDecksAuto() {
  const out = [];
  for (const baseRoot of bases()) {
    try {
      const idx = await getJSON(`${baseRoot}/index.json`);
      for (const entry of idx.decks || []) {
        const deck = await loadDeck(entry.id);
        if (deck?.valid) out.push({ id: entry.id, title: entry.title || entry.id, version: entry.version || 1 });
      }
      if (out.length) return out;
    } catch (e) {
      if (IS_DEV) console.warn('[deck-index] read failed from', baseRoot, e?.message || e);
    }
  }
  return out; // possibly empty
}
