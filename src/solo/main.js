import { TEMPLATE_FRONT } from "../config.js";
import { buildCardShell, startSlideThenFlip, renderFrontInline, buildFrontSVGDom } from "./cardView.js";
import { loadDeckList, loadDeck, categoriesFromCards, resolveSymbolKey, extractHints, pushHistory, renderHistory } from "./data.js";
import { seededRng, uuid } from "../lib/rng.js";
import { replaceTextTokens, fetchText } from "../lib/svg.js"; // for future needs

let els = {};
let deckList = [];
let currentDeckKey = null;
let currentCards = [];
let lastDrawKey = "";

init();

async function init(){
  mapEls();
  const { card, frontHolder } = buildCardShell(els.host);
  els.card = card; els.frontHolder = frontHolder;

  wireUI();

  // decks
  deckList = await loadDeckList();
  els.deckSel.innerHTML = deckList.map(d => `<option value="${d.key}">${d.name||d.key}</option>`).join("");
  currentDeckKey = new URL(location.href).searchParams.get("deck") || (deckList[0]?.key);
  els.deckSel.value = currentDeckKey;

  await loadCurrentDeck();

  hydrateFromURL();
  if (new URL(location.href).searchParams.get("seed")) {
    await drawCard(true);
  }
}

function mapEls(){
  els.host = document.getElementById("cardHost");
  els.deckSel = document.getElementById("deckSel");
  els.catSel = document.getElementById("catSel");
  els.drawBtn = document.getElementById("drawBtn");
  els.saveBtn = document.getElementById("saveBtn");
  els.copyLinkBtn = document.getElementById("copyLinkBtn");
  els.linkOut = document.getElementById("permaOut");
  els.meta = document.getElementById("meta");
  els.history = document.getElementById("history");
}

async function loadCurrentDeck(){
  currentCards = await loadDeck(currentDeckKey);
  const cats = categoriesFromCards(currentCards);
  els.catSel.innerHTML = `<option value="">All categories</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
}

function hydrateFromURL(){
  const p = new URL(location.href).searchParams;
  if(p.get("category")) els.catSel.value = p.get("category");
}

function wireUI(){
  els.deckSel.addEventListener("change", async ()=>{
    currentDeckKey = els.deckSel.value;
    await loadCurrentDeck();
    lastDrawKey = "";
    resetToBack();
  });
  els.catSel.addEventListener("change", ()=>{
    lastDrawKey = "";
    resetToBack();
  });
  els.drawBtn.addEventListener("click", ()=>drawCard(false));
  els.saveBtn.addEventListener("click", savePng);
  els.copyLinkBtn.addEventListener("click", copyPermalink);
}

function resetToBack(){ els.card.classList.remove("flipped"); }

async function drawCard(isFromPermalink){
  els.drawBtn.disabled = true;
  try{
    const category = els.catSel.value || "";
    let seed = "";
    const p = new URL(location.href).searchParams;
    seed = (isFromPermalink && p.get("seed")) ? p.get("seed") : uuid();

    const pool = category ? currentCards.filter(c => (c.category||"") === category) : currentCards;
    if(!pool.length){
      const emptySvg = await buildFrontSVGDom({CARD:"No cards", CATEGORY:(category||"All")}, "", []);
      renderFrontInline(els.frontHolder, emptySvg);
      return;
    }

    let idx = pickIndexNoImmediateRepeat(pool.length, `${seed}|${currentDeckKey}|${category}`, lastDrawKey);
    const card = pool[idx];
    const symbolKey = (p.get("symbol")||"").trim() || resolveSymbolKey(card);
    const hints = extractHints(card);

    const svg = await buildFrontSVGDom(card, symbolKey, hints);
    renderFrontInline(els.frontHolder, svg);
    startSlideThenFlip(els.card);

    const url = new URL(location.href);
    url.searchParams.set("deck", currentDeckKey);
    if(category) url.searchParams.set("category", category); else url.searchParams.delete("category");
    url.searchParams.set("seed", seed);
    history.replaceState(null, "", url.toString());
    els.linkOut.textContent = url.toString(); els.linkOut.title = url.toString();

    renderMeta({ deck: currentDeckKey, category, index: idx, total: pool.length });
    pushHistory({ card, deck: currentDeckKey, category, seed });
    renderHistory(els.history);

    els.saveBtn.disabled = false;
    els.copyLinkBtn.disabled = false;

    lastDrawKey = `${currentDeckKey}::${category||"*"}::${idx}`;
  } finally {
    els.drawBtn.disabled = false;
  }
}
function pickIndexNoImmediateRepeat(total, seedKey, lastKey){
  const rng = seededRng(seedKey);
  let idx = Math.floor(rng()*total);
  const attemptKey = i => `${currentDeckKey}::${els.catSel.value||"*"}::${i}`;
  if(lastKey && attemptKey(idx)===lastKey && total>1){
    idx = (idx + 1 + Math.floor(rng()*(total-1))) % total;
  }
  return idx;
}

function renderMeta({ deck, category, index, total }){
  els.meta.textContent = [`Deck: ${deck}`, category?`Category: ${category}`:`All categories`, `Card ${index+1}/${total}`].join("  ·  ");
}

async function savePng(){
  const wasBack = !els.card.classList.contains("flipped");
  if(wasBack && els.frontHolder.innerHTML) els.card.classList.add("flipped");
  const canvas = await html2canvas(els.card, { backgroundColor: null, scale: 2 });
  const a = document.createElement("a"); a.download = "tmls-card.png"; a.href = canvas.toDataURL("image/png"); a.click();
  if(wasBack && els.frontHolder.innerHTML) els.card.classList.remove("flipped");
}
async function copyPermalink(){
  await navigator.clipboard.writeText(els.linkOut.textContent);
  const old = els.copyLinkBtn.textContent; els.copyLinkBtn.textContent = "Copied!"; setTimeout(()=> els.copyLinkBtn.textContent = old, 900);
}
