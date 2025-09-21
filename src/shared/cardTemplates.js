// Lightweight config-only module. No rendering logic here.
export const cardTemplates = {
  front: {
    // Scales are relative to card width (0..1)
    logoScale: 0.82, // central brand/logo size on the front
    padding: 16,
    header: {
      showCategory: true,
      // Symbol left of category; category centered as a block
      symbolPlacement: "left", // 'left' | 'inline' | 'hidden'
      symbolSize: 20,
    },
    title: {
      showTitle: true,
      showSubtitle: true,
    },
    // You wanted the bottom box in reversed order previously.
    hints: {
      show: true,
      order: ["hint3", "hint2", "hint1"], // reverse display
      bullet: "•",
      clamp: 3, // max hints to render if present
    },
    footer: {
      showFlavor: true,
    },
  },
  back: {
    logoScale: 0.72, // usually smaller on the back
    padding: 20,
    showMandala: false, // you preferred no mandala; texture can be dynamic in app
  },
};

// Optional: a tiny helper so callers don't hardcode strings
export function orderedHints(card, tpl = cardTemplates.front.hints) {
  if (!tpl.show) return [];
  const pool = [
    ["hint1", card.hint1],
    ["hint2", card.hint2],
    ["hint3", card.hint3],
  ].filter(([, v]) => !!v);
  const byKey = Object.fromEntries(pool);
  const out = tpl.order
    .map((k) => byKey[k])
    .filter(Boolean)
    .slice(0, tpl.clamp);
  return out;
}
