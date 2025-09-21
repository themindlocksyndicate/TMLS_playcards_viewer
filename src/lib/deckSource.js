// src/lib/deckSource.js
const BASE =
  import.meta.env.VITE_DATASET_BASE ||
  "https://themindlocksyndicate.github.io/TMLS_playcards_datasets";

/**
 * We ondersteunen twee deckId's:
 * - 'cards'  → datasets/cards.json   (jouw huidige deck)
 * - <anders> → decks/<deckId>/deck.json of datasets/<deckId>.json (voor toekomstige decks)
 *
 * Genormaliseerd resultaat: { id, name, cards: [...], templates? }
 * Kaartrecord bevat minimaal: { code, title, ...rest }
 */
export async function loadDeckFromRepo(deckId = "cards") {
  if (deckId === "cards") {
    const url = `${BASE}/datasets/cards.json`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Deck not found: ${url}`);
    const list = await r.json(); // flat lijst (zie repo README)  // ← cards.json
    const cards = list.map(normalizeFromCardsJson);
    return { id: "cards", name: "TMLS Cards", cards };
  }

  // toekomstige decks:
  const urls = [
    `${BASE}/decks/${deckId}/deck.json`,
    `${BASE}/datasets/${deckId}.json`,
  ];
  let raw = null;
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) {
        raw = await r.json();
        break;
      }
    } catch {}
  }
  if (!raw) throw new Error(`Deck not found for id: ${deckId}`);

  const cards = (raw.cards || raw.list || []).map(normalizeGeneric);
  const templates =
    raw.templates && (raw.templates.front || raw.templates.back)
      ? {
          front: toAbsUrl(raw.templates.front),
          back: toAbsUrl(raw.templates.back),
        }
      : undefined;
  return { id: raw.id || deckId, name: raw.name || deckId, cards, templates };
}

// ---- normalizers ----

// JOUW huidige schema uit datasets/cards.json.
// README noemt o.a. kolommen: id, category, card, subtitle, symbol, rarity, color, hint1.., tags, notes, ... :contentReference[oaicite:1]{index=1}
function normalizeFromCardsJson(row) {
  // "code" gebruiken we als stabiele sleutel; neem id als die er is, anders slug van 'card'
  const code = String(
    row.id || slug(row.card || row.title || "")
  ).toUpperCase();
  // "title" tonen we op de kaart; neem 'card' als primaire titel
  const title = String(row.card || row.title || code);
  return { code, title, ...row };
}

// generiek voor andere decks
function normalizeGeneric(row) {
  const code = String(
    row.code || row.id || slug(row.title || "")
  ).toUpperCase();
  const title = String(row.title || row.card || code);
  return { code, title, ...row };
}

function slug(s) {
  return (
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "CARD"
  );
}

function toAbsUrl(maybe) {
  if (!maybe) return undefined;
  if (/^https?:\/\//i.test(maybe)) return maybe;
  return `${BASE}/${maybe.replace(/^\/+/, "")}`;
}
