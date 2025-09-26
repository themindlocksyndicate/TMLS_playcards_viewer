/**
 * Central runtime config used by deck loader / renderers.
 */
export const DATASET_BASE =
  (import.meta.env && import.meta.env.VITE_DATASET_BASE)
  || 'https://cdn.jsdelivr.net/gh/themindlocksyndicate/TMLS_playcards_datasets@main';

export const IS_DEV = !!(import.meta.env && import.meta.env.DEV);

/** Decide the default deck:
 *  1) ?deck=… in URL
 *  2) global CURRENT_DECK_ID
 *  3) fallback 'tmls-classic'
 */
export function pickDefaultDeck() {
  try {
    const url = new URL(globalThis.location?.href || 'http://local.test');
    return url.searchParams.get('deck')
        || globalThis.CURRENT_DECK_ID
        || 'tmls-classic';
  } catch {
    return globalThis.CURRENT_DECK_ID || 'tmls-classic';
  }
}
