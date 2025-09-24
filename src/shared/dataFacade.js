/**
 * Stable import surface to protect call sites across refactors.
 * Import your real modules here:
 */
import * as SoloData from '../solo/data.js';

// Re-export the bits we know the app relies on:
export const {
  loadDeck,
  categoriesFromCards,
  resolveSymbolKey
} = SoloData;

// Shim resolveDeckKey so historical imports never explode.
export function resolveDeckKey(input) {
  if (SoloData.resolveDeckKey) return SoloData.resolveDeckKey(input);
  return String(input || '').trim().toLowerCase().replace(/\s+/g, '-');
}
