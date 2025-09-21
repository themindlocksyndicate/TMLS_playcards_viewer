// src/lib/cardTemplates.js

// -------------------------------
// Helpers
// -------------------------------
const textDecoder = new TextDecoder();

// coerce number with default
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// SVG transform builder that uses SPACES (not commas)
function tform({ x = 0, y = 0, sx = 1, sy = 1, cx = 0, cy = 0 } = {}) {
  x = num(x);
  y = num(y);
  sx = num(sx, 1);
  sy = num(sy, 1);
  cx = num(cx);
  cy = num(cy);
  return `translate(${x} ${y}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
}

// Very light HTML/XML escape for text nodes
function esc(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// -------------------------------
// Normaliseren van kaartvelden
// -------------------------------
export function normalizeCard(raw) {
  const c = { ...raw };

  // titels / basismeta
  c.code = c.code ?? c.id ?? "";
  c.title = c.title ?? c.name ?? c.card ?? c.code ?? "Untitled";
  c.category = c.category ?? c.cat ?? c.group ?? "";
  c.symbol = c.symbol ?? c.icon ?? c.sig ?? "";
  c.rarity = c.rarity ?? c.rank ?? "";
  c.color = c.color ?? c.colour ?? "";

  // hints: 'hints' array of hint1/hint_1 / Hint 1 / hint 01 etc.
  let hints = [];
  if (Array.isArray(c.hints)) {
    hints = c.hints.filter(Boolean).map(String);
  } else {
    const pairs = Object.entries(c).filter(
      ([k, v]) => /^hint[ _]?\d+$/i.test(k) && v
    );
    pairs.sort((a, b) => {
      const na = parseInt(a[0].match(/\d+/)?.[0] || "0", 10);
      const nb = parseInt(b[0].match(/\d+/)?.[0] || "0", 10);
      return na - nb;
    });
    hints = pairs.map(([, v]) => String(v));
  }
  c.hints = hints;

  return c;
}

// -------------------------------
/** Templates laden
 *  - Deck kan overrides bevatten:
 *    deckData.templates?.front  (URL of pad)
 *    deckData.templates?.back
 *    deckData.logoUrl           (gold logo)
 *  - Default: /templates/front.svg en /templates/back.svg
 */
export async function loadTemplates(deckData = {}) {
  const frontUrl =
    deckData?.templates?.front ||
    deckData?.template?.front ||
    "/templates/front.svg";
  const backUrl =
    deckData?.templates?.back ||
    deckData?.template?.back ||
    "/templates/back.svg";

  const logoUrl = deckData?.logoUrl || "/brand/logo-gold.svg"; // mag je aanpassen naar je eigen pad

  const [frontResp, backResp] = await Promise.all([
    fetch(frontUrl),
    fetch(backUrl),
  ]);

  if (!frontResp.ok) throw new Error(`Failed to load front.svg (${frontUrl})`);
  if (!backResp.ok) throw new Error(`Failed to load back.svg (${backUrl})`);

  const [frontText, backText] = await Promise.all([
    frontResp.text(),
    backResp.text(),
  ]);

  return { frontText, backText, logoUrl };
}

// -------------------------------
// Token-vervanging Front
// -------------------------------
function applyFrontTokens(frontText, card) {
  const c = normalizeCard(card);

  // Basis tokens
  const map = new Map([
    ["TITLE", esc(c.title)],
    ["CATEGORY", esc(c.category)],
    ["SYMBOL", esc(c.symbol)],
    ["RARITY", esc(c.rarity)],
    ["COLOR", esc(c.color)],
    ["CODE", esc(c.code)],
  ]);

  // Hints individueel (1..6)
  for (let i = 1; i <= 6; i++) {
    const v = c.hints[i - 1] ?? "";
    map.set(`HINT_${i}`, esc(v));
  }

  // Samengevoegde hints (met <tspan> of newline, afhankelijk van je template)
  const joined = c.hints.map((h) => esc(h)).join("\n");
  map.set("HINTS", joined);

  let out = frontText;
  for (const [key, value] of map) {
    // vervang alle varianten {{KEY}} (met of zonder spaties)
    out = out.replaceAll(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value);
  }
  return out;
}

/**
 * renderFrontSVG
 * - Verwacht dat het front.svg tokens heeft zoals {{TITLE}}, {{CATEGORY}}, {{SYMBOL}}, {{HINT_1}}, …
 * - Geeft inline SVG string terug (veilig voor innerHTML)
 */
export function renderFrontSVG(frontText, cardObj) {
  return applyFrontTokens(frontText, cardObj);
}

// -------------------------------
// Back render: alleen LOGO_URL en optionele transforms
// -------------------------------
export function renderBackSVG(backText, { logoUrl } = {}) {
  let out = backText;

  // logo-pad invullen
  out = out.replaceAll(/{{\s*LOGO_URL\s*}}/g, esc(logoUrl || ""));

  // Optioneel: als je in het back.svg een transform token gebruikt zoals {{LOGO_TRANSFORM}},
  // kun je hier een nette transform genereren met spaties:
  // const tx = tform({ x: 412.5, y: 560, sx: 1.0, sy: 1.0, cx: 412.5, cy: 560 });
  // out = out.replaceAll(/{{\s*LOGO_TRANSFORM\s*}}/g, tx);

  return out;
}

// -------------------------------
// (optioneel) exporteer ook de helpers als je ze elders wilt gebruiken
// -------------------------------
export const _debug = { tform, esc, num, normalizeCard };
