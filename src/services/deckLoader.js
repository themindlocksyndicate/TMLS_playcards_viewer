const cache = new Map(); // deckId -> { base, config, cards, templates:{front,back}, valid:true }

/** Internal: fetch helpers */
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); }
async function getText(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.text(); }

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

  // Slots present?
  for (const [sideKey, sideCfg] of Object.entries({ front: config.front, back: config.back })) {
    const doc = sideKey === 'front' ? frontDoc : backDoc;
    if (!doc) continue;
    for (const [field, map] of Object.entries(sideCfg?.text || {})) {
      if (!hasId(doc, map.slot)) errors.push(`template:${sideKey} missing text slot "${map.slot}"`);
    }
    for (const g of sideCfg?.graphics || []) {
      if (!hasId(doc, g.slot)) errors.push(`template:${sideKey} missing graphic slot "${g.slot}"`);
    }
  }

  // Required text fields present for each card (no default text per spec)
  for (const card of cards?.cards || []) {
    for (const [field, map] of Object.entries(config.front?.text || {})) {
      if (!map.optional && (card.front?.[field] == null)) errors.push(`card ${card.code || '?'} missing front.${field}`);
    }
    for (const [field, map] of Object.entries(config.back?.text || {})) {
      if (!map.optional && (card.back?.[field] == null)) errors.push(`card ${card.code || '?'} missing back.${field}`);
    }
  }

  return errors;
}

/** Load a deck by id (returns null if invalid or failed). */
export async function loadDeck(deckId = 'tmls-classic') {
  if (cache.has(deckId)) return cache.get(deckId);

  const base = `/decks/${deckId}`;
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
      if (import.meta.env.DEV) console.warn(`[deck:${deckId}] invalid:`, errs);
      return null; // do not expose invalid decks
    }
    const ok = { ...deck, valid: true };
    cache.set(deckId, ok);
    return ok;
  } catch (e) {
    if (import.meta.env.DEV) console.error(`[deck:${deckId}] load failed:`, e);
    return null;
  }
}

/** Auto-list decks based on generated public/decks/index.json; returns only valid decks (after validation). */
export async function listDecksAuto() {
  try {
    const idx = await getJSON('/decks/index.json'); // created by scripts/generateDeckIndex.mjs
    const out = [];
    for (const entry of idx.decks || []) {
      const deck = await loadDeck(entry.id);
      if (deck?.valid) {
        out.push({ id: entry.id, title: entry.title || entry.id, version: entry.version || 1 });
      }
    }
    return out;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[deck-index] read failed:', e);
    return [];
  }
}
