export const cardTemplates = {
  front: {
    logoScale: 0.82,
    padding: 16,
    header: {
      showCategory: true,
      symbolPlacement: 'left', // 'left' | 'inline' | 'hidden'
      symbolSize: 20
    },
    title: {
      showTitle: true,
      showSubtitle: true
    },
    hints: {
      show: true,
      order: ['hint3', 'hint2', 'hint1'], // reversed
      bullet: '•',
      clamp: 3
    },
    footer: { showFlavor: true }
  },
  back: {
    logoScale: 0.72,
    padding: 20,
    showMandala: false
  }
};

export function orderedHints(card, tpl = cardTemplates.front.hints) {
  if (!tpl.show) return [];
  const pool = [
    ['hint1', card.hint1],
    ['hint2', card.hint2],
    ['hint3', card.hint3]
  ].filter(([, v]) => !!v);
  const byKey = Object.fromEntries(pool);
  return tpl.order.map(k => byKey[k]).filter(Boolean).slice(0, tpl.clamp);
}
