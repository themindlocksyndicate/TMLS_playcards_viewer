const cache = new Map(); // deckId -> { base, config, cards, templates:{front,back} }

export async function loadDeck(deckId = 'tmls-classic') {
  if (cache.has(deckId)) return cache.get(deckId);
  const base = `/decks/${deckId}`;
  const [config, cards, front, back] = await Promise.all([
    fetch(`${base}/deck.config.json`).then(r => r.json()),
    fetch(`${base}/cards.json`).then(r => r.json()).catch(() => ({ deck: deckId, cards: [] })),
    fetch(`${base}/templates/front.svg`).then(r => r.text()),
    fetch(`${base}/templates/back.svg`).then(r => r.text())
  ]);
  const deck = { base, config, cards, templates: { front, back } };
  cache.set(deckId, deck);
  return deck;
}
