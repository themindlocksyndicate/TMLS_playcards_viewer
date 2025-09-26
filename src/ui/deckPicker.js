import { listDecksAuto } from '../services/deckLoader.js';

function getParam(name) {
  try {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  } catch { return null; }
}
function setParam(name, value) {
  const u = new URL(location.href);
  if (value == null) u.searchParams.delete(name);
  else u.searchParams.set(name, value);
  location.href = u.toString(); // full reload so all data uses the new deck
}

/**
 * Renders a lightweight <select> into the page that lists ONLY valid decks.
 * - No warnings/errors shown to players.
 * - In dev, invalid decks are silently filtered (warnings only in console by deckLoader).
 */
export async function mountDeckPicker() {
  const mount = document.getElementById('deck-picker') || (() => {
    const header = document.querySelector('header') || document.body;
    const div = document.createElement('div');
    div.id = 'deck-picker';
    div.style.position = 'fixed';
    div.style.top = '10px';
    div.style.right = '10px';
    div.style.zIndex = '1000';
    header.appendChild(div);
    return div;
  })();

  const decks = await listDecksAuto(); // only valid decks returned
  const current = getParam('deck') || globalThis.CURRENT_DECK_ID || (decks[0]?.id ?? 'tmls-classic');
  globalThis.CURRENT_DECK_ID = current; // inform renderer default

  // If there is 0 or 1 deck, hide the picker UI (players don't need to choose)
  if (!decks.length || decks.length === 1) {
    mount.innerHTML = '';
    return;
  }

  const label = document.createElement('label');
  label.textContent = 'Deck: ';
  label.style.marginRight = '6px';
  label.style.fontFamily = 'monospace';
  label.style.fontSize = '12px';
  label.style.background = 'rgba(0,0,0,0.55)';
  label.style.padding = '4px 6px';
  label.style.borderRadius = '6px';
  label.style.color = '#E7C66D';

  const select = document.createElement('select');
  select.ariaLabel = 'Deck selector';
  select.style.fontFamily = 'monospace';
  select.style.fontSize = '12px';
  select.style.padding = '4px 6px';
  select.style.borderRadius = '6px';
  select.style.background = '#111';
  select.style.color = '#E7C66D';
  select.style.border = '1px solid #3a2f14';

  for (const d of decks) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.title || d.id;
    if (d.id === current) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => {
    const deckId = e.target.value;
    globalThis.CURRENT_DECK_ID = deckId;
    // Use query param so refreshes & share links preserve the deck
    setParam('deck', deckId);
  });

  mount.innerHTML = '';
  mount.appendChild(label);
  mount.appendChild(select);
}
