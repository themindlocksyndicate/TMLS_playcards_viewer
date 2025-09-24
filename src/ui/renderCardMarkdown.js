import { cardTemplates, orderedHints } from '../shared/cardTemplates.js';

export function renderCardMarkdown(card) {
  const lines = [];
  lines.push(`# ${card.title || card.code}`);
  const meta = [
    ['Category', card.category],
    ['Symbol', card.symbol],
    ['Rarity', card.rarity],
    ['Color', card.color],
  ].filter(([, v]) => v != null && String(v).trim() !== '');
  for (const [k, v] of meta) lines.push(`- **${k}:** ${v}`);

  const hints = orderedHints(card, cardTemplates.front.hints);
  if (hints.length) {
    lines.push('');
    for (const h of hints) lines.push(`> ${h}`);
  }
  return lines.join('\n');
}
