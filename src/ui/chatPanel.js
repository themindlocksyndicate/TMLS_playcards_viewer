// src/ui/chatPanel.js
import { onMessages, sendMessage } from "../services/room.js";

import { loadDeckFromRepo } from "../lib/deckSource.js";
import { loadTemplates, renderFrontSVG } from "../lib/cardTemplates.js";

/**
 * Chat panel met kaartvisualisatie voor type 'card'
 * @param {HTMLElement} root
 * @param {{roomCode:string, uid:string}} ctx
 * @returns {() => void} unmount
 */
export function mountChatPanel(root, { roomCode, uid }) {
  root.innerHTML = `
    <div class="h-full flex flex-col">
      <!-- header -->
      <div class="px-3 py-2 border-b border-[rgb(217_180_99_/_0.25)] bg-black/30">
        <div class="text-sm opacity-80">Room chat</div>
      </div>

      <!-- messages -->
      <div id="cp-scroll" class="flex-1 overflow-auto px-3 py-3 space-y-3">
        <!-- messages injected here -->
      </div>

      <!-- composer (sticky) -->
      <div class="sticky bottom-0 bg-black/40 border-t border-[rgb(217_180_99_/_0.25)] p-2">
        <form id="cp-form" class="flex items-end gap-2">
          <textarea id="cp-input"
            class="min-h-[36px] max-h-40 flex-1 resize-y rounded-lg bg-black/40 border border-[rgb(217_180_99_/_0.25)] px-3 py-2 text-sm outline-none focus:border-[rgb(217_180_99_/_0.5)]"
            placeholder="Type a message… (Enter = send, Shift+Enter = newline)"></textarea>
          <button id="cp-send" type="submit"
            class="px-3 py-2 rounded-xl border border-[rgb(217_180_99_/_0.5)] hover:bg-[rgb(217_180_99_/_0.12)] text-sm">
            Send
          </button>
        </form>
      </div>
    </div>
  `;

  const scroll = root.querySelector("#cp-scroll");
  const form = root.querySelector("#cp-form");
  const input = root.querySelector("#cp-input");

  // --- deck + templates lazy loaded (voor kaart rendering in chat)
  let deckData = null; // {cards:[...], assets:{logo?...}}
  let templates = null; // {frontText, backText, logoUrl}

  async function ensureDeckLoaded() {
    if (deckData && templates) return;
    // deck via URL param ?deck=… (fallback 'cards')
    const deckId = new URLSearchParams(location.search).get("deck") || "cards";
    deckData = await loadDeckFromRepo(deckId);
    templates = await loadTemplates(deckData);
  }

  // Escaper voor plain text
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // ---- helpers: chat bubble builders ----
  function bubbleBase({ mine }) {
    const w = document.createElement("div");
    w.className = [
      "max-w-[92%] md:max-w-[80%]",
      mine ? "ml-auto text-right" : "mr-auto text-left",
      "flex flex-col gap-1",
    ].join(" ");
    return w;
  }

  function metaLine({ display, ts, mine }) {
    const m = document.createElement("div");
    m.className = [
      "text-[10px] uppercase tracking-wide opacity-50",
      mine ? "self-end" : "self-start",
    ].join(" ");
    m.textContent = `${display || "Someone"} · ${ts || ""}`;
    return m;
  }

  function makeTextBubble({ text, mine }) {
    const w = bubbleBase({ mine });
    const b = document.createElement("div");
    b.className = [
      "rounded-2xl px-3 py-2 text-sm leading-5",
      "border border-[rgb(217_180_99_/_0.25)]",
      mine ? "bg-[rgb(20_20_20_/_0.9)]" : "bg-[rgb(10_10_10_/_0.85)]",
    ].join(" ");
    // eenvoudige markdown-lite: alleen regels en **bold** / *italic* minimaal
    const html = esc(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");
    b.innerHTML = html;
    w.appendChild(b);
    return w;
  }

  function makeCardBubble({ cards, mine }) {
    const w = bubbleBase({ mine });

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-3";

    for (const card of cards) {
      const holder = document.createElement("div");
      holder.className = [
        "rounded-xl overflow-hidden",
        "border border-[rgb(217_180_99_/_0.25)]",
        "bg-[rgb(10_10_10)]",
        "shadow-[0_0_20px_rgba(0,0,0,0.35)]",
        "w-full max-w-[360px] mx-auto",
      ].join(" ");

      // aspect 2/3 en ruim formaat voor impact
      const inner = document.createElement("div");
      inner.className = "relative w-full aspect-[2/3]";

      // inline SVG front
      const svg = renderFrontSVG(templates.frontText, card);
      inner.innerHTML = svg;

      holder.appendChild(inner);
      grid.appendChild(holder);
    }

    w.appendChild(grid);
    return w;
  }

  // Probeert uit een "card" bericht de daadwerkelijke kaarten te herleiden.
  // Ondersteunt:
  //  - message.cards: ["CODE1","CODE2"] (aanbevolen)
  //  - of parse van markdown: blokken gescheiden door --- met eerste regel "# Title"
  function extractCardsFromMessage(msg) {
    if (!deckData) return [];
    const byCode = new Map(
      deckData.cards.map((c) => [String(c.code).toUpperCase(), c])
    );
    const byTitle = new Map(
      deckData.cards
        .filter((c) => c.title)
        .map((c) => [String(c.title).trim().toLowerCase(), c])
    );

    // 1) payload cards (beste pad)
    if (Array.isArray(msg.cards) && msg.cards.length) {
      const cards = [];
      for (const raw of msg.cards) {
        const code = String(raw).toUpperCase();
        const card = byCode.get(code);
        if (card) cards.push(card);
      }
      if (cards.length) return cards;
    }

    // 2) parse markdown (fallback)
    if (typeof msg.text === "string" && msg.text.trim()) {
      const blocks = msg.text.split(/\n---\n/); // zelfde scheiding als drawN()
      const found = [];
      for (const block of blocks) {
        const m = block.match(/^\s*#\s+(.+)\s*$/m);
        if (!m) continue;
        const title = m[1].trim().toLowerCase();
        const card = byTitle.get(title);
        if (card) found.push(card);
      }
      if (found.length) return found;
    }

    return [];
  }

  // Render 1 bericht
  function renderMessage(doc) {
    const data = doc.data || doc; // ondersteunt raw object of {data}
    const mine = data.uid === uid;
    const display = data.displayName || (mine ? "You" : "Guest");
    const ts = data.createdAt?.toDate?.()
      ? new Date(data.createdAt.toDate()).toLocaleTimeString()
      : "";

    const wrap = document.createElement("div");

    // meta
    wrap.appendChild(metaLine({ display, ts, mine }));

    // body
    if (data.type === "card") {
      // zorg dat deck/templates klaar zijn
      // let op: renderMessage kan sync zijn; we maken een async flow die later in-place update.
      const shell = document.createElement("div");
      shell.className = mine ? "ml-auto" : "mr-auto";
      wrap.appendChild(shell);

      (async () => {
        try {
          await ensureDeckLoaded();
          const cards = extractCardsFromMessage(data);
          if (cards.length) {
            const bubble = makeCardBubble({ cards, mine });
            shell.replaceChildren(bubble);
          } else {
            // fallback naar markdown tekst
            const bubble = makeTextBubble({ text: data.text || "", mine });
            shell.replaceChildren(bubble);
          }
        } catch (e) {
          const bubble = makeTextBubble({
            text: data.text || "(failed to render card)",
            mine,
          });
          shell.replaceChildren(bubble);
        }
        // na insert: autoscroll
        scrollToBottom();
      })();
    } else {
      const bubble = makeTextBubble({ text: data.text || "", mine });
      wrap.appendChild(bubble);
    }

    return wrap;
  }

  function scrollToBottom() {
    // smooth bij nieuw bericht
    scroll?.scrollTo({ top: scroll.scrollHeight + 9999, behavior: "smooth" });
  }

  // live feed
  const unmessages = onMessages(roomCode, (list) => {
    // list is in tijdsvolgorde (aanname services/room.js doet query orderBy('createdAt','asc'))
    scroll.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const m of list) {
      frag.appendChild(renderMessage(m));
    }
    scroll.appendChild(frag);
    scrollToBottom();
  });

  // composer gedrag
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    try {
      await sendMessage({
        roomCode,
        uid,
        type: "chat",
        text,
      });
      input.value = "";
      input.style.height = ""; // reset eventuele resize
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  return () => {
    unmessages?.();
  };
}
