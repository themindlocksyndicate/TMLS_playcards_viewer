import { mountDeckPicker } from './src/ui/deckPicker.js';

document.addEventListener('DOMContentLoaded', () => {
  // Mount deck picker if the element exists (supports either selector)
  const el =
    document.querySelector('[data-deck-picker]') ||
    document.querySelector('#deck-picker');
  if (el) {
    try { mountDeckPicker(el); } catch (e) { /* keep silent in prod */ }
  }
});
