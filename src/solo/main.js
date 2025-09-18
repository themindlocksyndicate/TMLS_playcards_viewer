// src/solo/main.js  — drop-in replacement

import {
  loadDeckList,
  loadDeck,
  categoriesFromCards,
  resolveDeckKey,
  resolveSymbolKey,
  extractHints,
  pushHistory,
  renderHistory
} from "./data.js";
import { seededRng, uuid } from "../lib/rng.js";
import { buildFrontSVGDom } from "./cardView.js"; // <-- correct import

/* ---------- tiny inline helpers (no external ui-helpers needed) ---------- */
const $ = (id) => document.getElementById(id);
const setPermalink = (url) => {
  const out = $("permaOut");
  if (out) { out.textContent = url; out.title = url; }
};
const setMeta = (text) => { const m = $("meta"); if (m) m.textContent = text; };
const resetToBack = (cardEl) => cardEl.classList.remove("flipped");
const showStatus = (msg, type = "info") => console[type === "error" ? "error" : "log"](`[${type}] ${msg}`);
/* ------------------------------------------------------------------------ */

let els = {};
let deckList = [];
let currentDeckKey = null;
let currentCards = [];
let lastDrawKey = "";

init().catch(err => { console.error(err); showStatus("Failed to initialize Solo. Check console.", "error"); });

async function init() {
  mapEls();
  mountCard();     // create the back/front shell
  bindUI();

  // 1) Load deck index
  deckList = await loadDeckList();

  // 2) Resolve requested deck safely
  const requestedDeck = new URL(location.href).searchParams.get("deck");
  currentDeckKey = resolveDeckKey(deckList, requestedDeck);

  // 3) Build deck dropdown + load deck
  els.deckSel.innerHTML = deckList.map(d => `<option value="${d.key}">${d.name || d.key}</option>`).join("");
  els.deckSel.value = currentDeckKey;
  await loadCurrentDeck();

  // 4) Hydrate category from URL if valid
  const p = new URL(location.href).searchParams;
  const urlCat = p.get("category");
  if (urlCat && categoriesFromCards(currentCards).includes(urlCat)) els.catSel.value = urlCat;

  // 5) Reproduce permalink draw once (if ?seed=...), else wait for user click
  if (p.get("seed")) await drawCard(true);
}

function mapEls() {
  els.host = $("cardHost");
  els.deckSel = $("deckSel");
  els.catSel = $("catSel");
  els.drawBtn = $("drawBtn");
  els.saveBtn = $("saveBtn");
  els.copyLinkBtn = $("copyLinkBtn");
  els.linkOut = $("permaOut");
  els.meta = $("meta");
  els.history = $("history");
}

function mountCard() {
  els.host.innerHTML = `
    <div class="card" id="card">
      <div class="card-inner" id="cardInner">
        <div class="face back">
          <img id="backImg" alt="Card back" src="./templates/back.svg">
        </div>
        <div class="face front">
          <div id="frontSvgHolder"></div>
        </div>
      </div>
    </div>`;
  els.card = $("card");
  els.frontHolder = $("frontSvgHolder");
}

function bindUI() {
  els.deckSel.addEventListener("change", async () => {
    currentDeckKey = resolveDeckKey(deckList, els.deckSel.value);
    els.deckSel.value = currentDeckKey;
    await loadCurrentDeck();
    lastDrawKey = "";
    resetToBack(els.card);
  });
  els.catSel.addEventListener("change", () => {
    lastDrawKey = "";
    resetToBack(els.card);
  });
  els.drawBtn.addEventListener("click", () => drawCard(false));
  els.saveBtn.addEventListener("click", savePng);
  els.copyLinkBtn.addEventListener("click", copyPermalink);
}

async function loadCurrentDeck() {
  currentCards = await loadDeck(currentDeckKey);
  const cats = categoriesFromCards(currentCards);
  els.catSel.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

async function drawCard(isFromPermalink) {
  els.drawBtn.disabled = true;
  try {
    const category = els.catSel.value || "";
    const p = new URL(location.href).searchParams;
    const seed = (isFromPermalink && p.get("seed")) ? p.get("seed") : uuid();

    const pool = category ? currentCards.filter(c => (c.category || "") === category) : currentCards;
    if (!pool.length) {
      setMeta(`Deck: ${currentDeckKey} · ${category || "All categories"} · No cards`);
      return;
    }

    let idx = pickIndexNoImmediateRepeat(pool.length, `${seed}|${currentDeckKey}|${category}`, lastDrawKey);
    const card = pool[idx];

    const symbolKey = (p.get("symbol") || "").trim() || resolveSymbolKey(card);
    const hints = extractHints(card);

    const svg = await buildFrontSVGDom(card, symbolKey, hints);
    els.frontHolder.innerHTML = "";
    els.frontHolder.appendChild(svg);

    // slide-in (back) → flip (front)
    els.card.classList.remove("flipped");
    els.card.classList.add("is-enter");
    void els.card.offsetWidth;
    els.card.classList.remove("is-enter");
    els.card.classList.add("is-slide");
    const onEnd = (e) => {
      if (e.propertyName !== "transform") return;
      els.card.classList.remove("is-slide");
      els.card.removeEventListener("transitionend", onEnd);
      setTimeout(() => els.card.classList.add("flipped"), 60);
    };
    els.card.addEventListener("transitionend", onEnd);

    // permalink + meta + history
    const url = new URL(location.href);
    url.searchParams.set("deck", currentDeckKey);
    if (category) url.searchParams.set("category", category); else url.searchParams.delete("category");
    url.searchParams.set("seed", seed);
    history.replaceState(null, "", url.toString());
    setPermalink(url.toString());

    setMeta([`Deck: ${currentDeckKey}`, category ? `Category: ${category}` : "All categories", `Card ${idx + 1}/${pool.length}`].join(" · "));
    pushHistory({ card, deck: currentDeckKey, category, seed });
    renderHistory(els.history);

    els.saveBtn.disabled = false;
    els.copyLinkBtn.disabled = false;

    lastDrawKey = `${currentDeckKey}::${category || "*"}::${idx}`;
  } catch (e) {
    console.error(e);
    showStatus("Failed to draw card. Check console.", "error");
  } finally {
    els.drawBtn.disabled = false;
  }
}

function pickIndexNoImmediateRepeat(total, seedKey, lastKey) {
  const rng = seededRng(seedKey);
  let idx = Math.floor(rng() * total);
  const attemptKey = (i) => `${currentDeckKey}::${els.catSel.value || "*"}::${i}`;
  if (lastKey && attemptKey(idx) === lastKey && total > 1) {
    idx = (idx + 1 + Math.floor(rng() * (total - 1))) % total;
  }
  return idx;
}

async function savePng() {
  const wasBack = !els.card.classList.contains("flipped");
  if (wasBack && els.frontHolder.innerHTML) els.card.classList.add("flipped");
  const canvas = await html2canvas(els.card, { backgroundColor: null, scale: 2 });
  const a = document.createElement("a");
  a.download = "tmls-card.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
  if (wasBack && els.frontHolder.innerHTML) els.card.classList.remove("flipped");
}

async function copyPermalink() {
  await navigator.clipboard.writeText(els.linkOut.textContent);
  const old = els.copyLinkBtn.textContent;
  els.copyLinkBtn.textContent = "Copied!";
  setTimeout(() => (els.copyLinkBtn.textContent = old), 900);
}
