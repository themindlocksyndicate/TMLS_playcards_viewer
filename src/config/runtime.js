/**
 * Central runtime config.
 * - DATASET_BASE: where to load decks/cards from.
 *   Defaults to your dataset repo CDN (works on localhost and GitHub Pages).
 *   Can be overridden via VITE_DATASET_BASE in .env.local
 */
export const DATASET_BASE =
  import.meta.env.VITE_DATASET_BASE
  || 'https://cdn.jsdelivr.net/gh/themindlocksyndicate/TMLS_playcards_datasets@main';

export const IS_DEV = !!import.meta.env.DEV;

// Decide default deck from URL (?deck=...) or global, else tmls-classic
export function pickDefaultDeck() {
  try {
    const u = new URL(location.href);
    const q = u.searchParams.get('deck');
    if (q) return q;
  } catch {}
  return globalThis.CURRENT_DECK_ID || 'tmls-classic';
}
