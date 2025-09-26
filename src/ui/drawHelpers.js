import { renderFrontSVG, renderBackSVG } from '../lib/cardTemplates.js';

/**
 * Renders a card into provided elements.
 * Always async; returns a Promise; never throws (logs only in dev).
 */
export async function renderCardFaces(frontEl, backEl, card, opts = {}) {
  try {
    const [front, back] = await Promise.all([
      renderFrontSVG(card, opts),
      renderBackSVG(card, opts),
    ]);
    if (frontEl) frontEl.innerHTML = front || '';
    if (backEl)  backEl.innerHTML  = back  || '';
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('renderCardFaces failed', e);
  }
}
