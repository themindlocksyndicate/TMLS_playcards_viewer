import { DATASET_BASE, DEFAULT_DECK, HISTORY_KEY } from "../config.js";
import { escapeAttr, escapeHtml } from "../lib/svg.js";

export async function loadDeckList(){
  try{
    const res = await fetch(`${DATASET_BASE}/index.json`, {cache:"no-store"});
    if(res.ok){
      const idx = await res.json();
      if(Array.isArray(idx) && idx.length) return idx;
    }
  }catch(_){}
  return [{ key: DEFAULT_DECK, name: "Default Deck" }];
}

export async function loadDeck(key){
  const res = await fetch(`${DATASET_BASE}/${key}`, {cache:"no-store"});
  const data = await res.json();
  return Array.isArray(data) ? data : (data.cards || []);
}

export function categoriesFromCards(cards){
  return Array.from(new Set(cards.map(c => (c.category||"").trim()).filter(Boolean))).sort();
}

export function resolveSymbolKey(card){
  const raw = card.symbol_key ?? card.symbolName ?? card.symbol_name ?? card.symbol_id ??
              (typeof card.symbol==="string" ? card.symbol : "");
  return kebab((raw||"").trim());
}
export function extractHints(c){
  if (Array.isArray(c.hints)) return c.hints.filter(Boolean);
  const keys = Object.keys(c).filter(k => /^hint/i.test(k)).sort();
  return keys.map(k => c[k]).filter(Boolean);
}
export function kebab(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }

/* history helpers */
export function pushHistory({ card, deck, category, seed }){
  try{
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
    arr.unshift({ t:Date.now(), card, deck, category, seed });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0,12)));
  }catch(_){}
}
export function renderHistory(listEl){
  const arr = JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
  listEl.innerHTML = arr.map(entry=>{
    const c = entry.card||{};
    const title = escapeHtml((c.card||c.title||"Untitled"));
    const cats = escapeHtml(c.category||entry.category||"");
    const sub = escapeHtml(c.subtitle||"");
    const md = cardToMarkdown(c);
    return `
      <div class="hist-card">
        <div class="hist-title">${title}</div>
        <div class="hist-sub">${cats}${sub?` — ${sub}`:""}</div>
        <div class="hist-actions">
          <button class="btn btn-outline" data-md='${escapeAttr(md)}'>Copy .md</button>
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll("button[data-md]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await navigator.clipboard.writeText(btn.getAttribute("data-md"));
      const prev = btn.textContent; btn.textContent="Copied!"; setTimeout(()=>btn.textContent=prev,800);
    });
  });
}
function cardToMarkdown(c){
  const hints = extractHints(c).map(h=>`- ${h}`).join("\n");
  return `### ${c.card||c.title||"Untitled"}\n**Category:** ${c.category||""}\n**Symbol:** ${c.symbol||""}\n\n${c.subtitle||""}\n\n${hints}\n`;
}
