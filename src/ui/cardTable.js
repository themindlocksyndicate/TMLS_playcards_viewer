import { renderCardFaces } from "./drawHelpers.js";
// src/ui/cardTable.js
import { onEvents, addEvent, sendMessage } from "../services/room.js";
import { loadDeckFromRepo } from "../lib/deckSource.js";
import {
  loadTemplates,
  renderFrontSVG,
  renderBackSVG,
  cardTemplates,
  orderedHints,
} from "../lib/cardTemplates.js";

// ------------------------------------------------------------
// Events -> state (append-only; we diffen in de UI)
// ------------------------------------------------------------
function reduceEvents(events) {
  const state = { deckId: "cards", drawn: [], revealed: new Set() };

  for (const ev of events) {
    const { action, payload = {} } = ev;

    if (action === "init") {
      if (payload.deckId) state.deckId = payload.deckId;
    }

    if (action === "reset") {
      state.drawn = [];
      state.revealed.clear();
    }

    if (action === "draw") {
      if (Array.isArray(payload.cards) && payload.cards.length) {
        for (const code of payload.cards) {
          const c = String(code).toUpperCase();
          if (!state.drawn.includes(c)) state.drawn.push(c);
        }
      } else {
        // (fallback) n kaarten -> placeholders die we later mappen
        const n = Math.max(1, payload.n || 1);
        state.drawn.push(...Array(n).fill(null));
      }
    }

    if (action === "flip" && payload.card) {
      const code = String(payload.card).toUpperCase();
      if (state.revealed.has(code)) state.revealed.delete(code);
      else state.revealed.add(code);
    }
  }
  return state;
}

// ------------------------------------------------------------
// Mount
// ------------------------------------------------------------
export function mountCardTable(root, { roomCode, uid, isHost = false }) {
  root.innerHTML = `
    <div class="h-full w-full flex flex-col">
      <div class="flex items-center justify-between px-3 py-2">
        <div class="text-sm opacity-70">Card Table</div>
        <div class="hidden md:flex gap-2">
          <button id="ct-draw" class="btn">Draw</button>
          <button id="ct-reset" class="btn">Reset</button>
        </div>
      </div>
      <div id="ct-grid" class="flex-1 grid p-4 gap-4
                               grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3
                               content-start overflow-auto"></div>
    </div>
  `;

  const grid = root.querySelector("#ct-grid");
  const btnDraw = root.querySelector("#ct-draw");
  const btnReset = root.querySelector("#ct-reset");

  /** @type {Map<string,{el:HTMLElement,revealed:boolean}>} */
  const rendered = new Map();

  let deckId = null;
  let deckData = null; // { cards:[{code,title,...}], ... }
  let templates = null; // { frontText, backText, backUrl?, logoUrl? }
  let lastState = null; // voor lokale bepaling volgende kaart(en)

  const unevents = onEvents(roomCode, async (events) => {
    const s = reduceEvents(events);

    // Host init (éénmalig)
    if (isHost && !events.some((e) => e.action === "init")) {
      const urlDeck =
        new URLSearchParams(location.search).get("deck") || "cards";
      await addEvent({
        roomCode,
        uid,
        action: "init",
        payload: { deckId: urlDeck },
      });
      return;
    }

    // Deck & templates lazy load
    if (s.deckId !== deckId) {
      deckId = s.deckId || "cards";
      deckData = await loadDeckFromRepo(deckId);
      templates = await loadTemplates(deckData);
    }

    // Plaatsvervangers (null) mappen naar volgorde uit deckData
    const order = deckData.cards.map((c) => String(c.code).toUpperCase());
    const drawnCodes = [];
    let nextIndex = 0;
    for (const mark of s.drawn) {
      if (mark) {
        drawnCodes.push(String(mark).toUpperCase());
        continue;
      }
      while (nextIndex < order.length && drawnCodes.includes(order[nextIndex]))
        nextIndex++;
      if (nextIndex < order.length) drawnCodes.push(order[nextIndex++]);
    }

    // Render diff (incl. verwijderen bij reset)
    renderDiff(grid, drawnCodes, s.revealed, rendered, {
      roomCode,
      uid,
      deckData,
      templates,
    });

    lastState = { deckId, drawnCodes, revealed: new Set(s.revealed) };
  });

  // Draw N: lokaal volgende codes bepalen -> event + chat .md
  async function drawN(n = 1) {
    if (!deckData) return;
    const order = deckData.cards.map((c) => String(c.code).toUpperCase());
    const taken = new Set(lastState?.drawnCodes || []);
    const toDraw = [];
    for (const code of order) {
      if (toDraw.length >= n) break;
      if (!taken.has(code)) {
        toDraw.push(code);
        taken.add(code);
      }
    }
    if (toDraw.length === 0) return;

    // 1) draw-event met expliciete kaarten
    await addEvent({
      roomCode,
      uid,
      action: "draw",
      payload: { cards: toDraw },
    });

    // 2) markdown log naar chat
    const lines = [];
    for (const code of toDraw) {
      const card = deckData.cards.find(
        (c) => String(c.code).toUpperCase() === code
      );
      if (!card) continue;
      lines.push(renderCardMarkdown(card));
    }
    const md = lines.join("\n\n---\n\n");
    // 2) Markdown + structured payload voor de chat preview
    await sendMessage({
      roomCode,
      uid,
      type: "card",
      text: md,
      payload: {
        deckId: deckId || "cards",
        codes: toDraw, // ["C01","C17",...]
      },
    });
  }

  btnDraw?.addEventListener("click", () => drawN(1));

  btnReset?.addEventListener("click", async () => {
    if (!confirm("Reset table for everyone?")) return;
    try {
      await addEvent({ roomCode, uid, action: "reset" });
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  return () => {
    unevents?.();
    rendered.clear();
  };
}

// ------------------------------------------------------------
// Rendering (no flicker, volledige reconcile)
// ------------------------------------------------------------
function renderDiff(grid, codes, revealedSet, rendered, ctx) {
  const { roomCode, uid, deckData, templates } = ctx;
  const byCode = new Map(
    deckData.cards.map((c) => [String(c.code).toUpperCase(), c])
  );
  const desired = new Set(codes);

  // 1) Verwijder kaarten die niet meer gewenst zijn (bv. reset)
  for (const key of Array.from(rendered.keys())) {
    if (!desired.has(key)) {
      const { el } = rendered.get(key);
      el?.remove();
      rendered.delete(key);
    }
  }

  // 2) Append nieuwe
  if (rendered.size < codes.length) {
    const frag = document.createDocumentFragment();
    for (const code of codes) {
      if (rendered.has(code)) continue;
      const card = byCode.get(code) || { code, title: code };
      const el = makeCardEl(card, templates);
      frag.appendChild(el);
      rendered.set(code, { el, revealed: false });

      el.addEventListener("click", async () => {
        try {
          await addEvent({
            roomCode,
            uid,
            action: "flip",
            payload: { card: code },
          });
        } catch (e) {
          alert(e.message || String(e));
        }
      });
    }
    grid.appendChild(frag);
  }

  // 3) Update flip state (alleen classes/visibility togglen)
  for (const code of codes) {
    const entry = rendered.get(code);
    if (!entry) continue;
    const should = revealedSet.has(code);
    if (should !== entry.revealed) {
      entry.revealed = should;
      const face = entry.el.querySelector("[data-face]");
      const back = entry.el.querySelector("[data-back]");
      entry.el.classList.toggle("revealed", should);
      entry.el.classList.toggle("back", !should);
      if (should) {
        back?.classList.add("hidden");
        face?.classList.remove("hidden");
      } else {
        face?.classList.add("hidden");
        back?.classList.remove("hidden");
      }
    }
  }
}

// ------------------------------------------------------------
// Element builders
// ------------------------------------------------------------
function makeCardEl(card, templates) {
  const el = document.createElement("button");
  el.className = [
    "ct-card",
    "group",
    "relative",
    "aspect-[2/3]",
    "w-full",
    "max-w-[320px]",
    "border",
    "border-[rgb(217_180_99_/_0.25)]",
    "rounded-xl",
    "overflow-hidden",
    "bg-[rgb(10_10_10)]",
    "hover:translate-y-[-2px]",
    "transition-transform",
    "shadow-[0_0_20px_rgba(0,0,0,0.35)]",
    "back",
  ].join(" ");
  el.dataset.code = card.code;

  // FACE: inline SVG met tokens
  const faceWrap = document.createElement("div");
  faceWrap.setAttribute("data-face", "");
  faceWrap.className =
    "absolute inset-0 flex items-center justify-center p-2 hidden";
  renderFrontSVG(templates.frontText, card).then(svg => { faceWrap.innerHTML = svg; });

  // BACK: inline SVG zodat we logo-url kunnen injecteren
  const backWrap = document.createElement("div");
  backWrap.setAttribute("data-back", "");
  backWrap.className = "absolute inset-0 w-full h-full";
  backWrap.innerHTML = renderBackSVG(templates.backText, {
    logoUrl: templates.logoUrl,
    logoScale: (cardTemplates?.back?.logoScale ?? 0.72), // template-driven scale
    doorOpacity: 0.75, // iets transparanter
  });

  el.appendChild(faceWrap);
  el.appendChild(backWrap);
  return el;
}

// ------------------------------------------------------------
// Markdown voor chat-log
// ------------------------------------------------------------
function renderCardMarkdown(c) {
  const lines = [];
  lines.push(`# ${c.title || c.code}`);
  const meta = [
    ["Category", c.category],
    ["Symbol", c.symbol],
    ["Rarity", c.rarity],
    ["Color", c.color],
  ].filter(([, v]) => v != null && String(v).trim() !== "");
  for (const [k, v] of meta) lines.push(`- **${k}:** ${v}`);

  const hints = [];
  for (const k of Object.keys(c))
    if (/^hint[_ ]?\d+$/i.test(k) && c[k]) hints.push(String(c[k]));
  if (hints.length) {
    lines.push("");
    for (const h of hints) lines.push(`> ${h}`);
  }
  return lines.join("\n");
}

// DRAW_WIRING_ANCHOR — safe draw wiring (only if not already wired)
(function(){
  const btn = document.querySelector('[data-action=draw], #drawButton, button.draw, #draw');
  if (!btn) return;                // no button found, do nothing
  if (btn.dataset.wired === "1") return;
  if (typeof btn.onclick === "function") return; // respect existing handler
  btn.dataset.wired = "1";

  btn.addEventListener("click", async () => {
    try {
      // Try common containers; adapt automatically to your DOM
      const front = document.querySelector('#card-front, #front, .card-front');
      const back  = document.querySelector('#card-back,  #back,  .card-back');

      // Derive the next card from existing app state when available:
      const card =
        (globalThis.TMLS_NEXT_CARD && globalThis.TMLS_NEXT_CARD()) ||
        globalThis.currentCard ||
        { code: 'C-001', front: { title: 'Card' }, back: {} };

      await renderCardFaces(front, back, card);

      // Notify listeners (harmless if none)
      document.dispatchEvent(new CustomEvent('tmls:drawn', { detail:{ card } }));
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('draw handler failed', e);
    }
  });
})();
