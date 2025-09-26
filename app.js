import { initializeApp } from "firebase/app";
import { ensureAnonAuth, setupAppCheck } from "@services/startupAuth.js";
import { createRoom, joinRoom } from "@services/room.api.js";
import { mountDeckPicker } from "@ui/deckPicker.js";
import { mountDeckPicker } from "@ui/deckPicker.js";
import "./src/styles/tailwind.css";
import "@services/startupFirebase.js";
// app.js — Multiplayer + Chat + Export + Hard Terminate (no TTL/Functions)

import {
  doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp,
  collection, setDoc as setSubDoc, addDoc, query, orderBy,
  onSnapshot as onSnapMsgs, getDocs, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

(async function main() {
  const { auth, db } = await window.tmls.ready;

  // ------- Config -------
  const DECK_URL = "https://themindlocksyndicate.github.io/TMLS_playcards_datasets/datasets/cards.json";

  // ------- Utilities -------
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function esc(s){ return (s??"").replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function roomCodeFromUrl(){ return new URLSearchParams(location.search).get("room") || ""; }
  function setUrl(code){
    const url = new URL(location.href);
    url.searchParams.set("room", code);
    history.replaceState(null, "", url.toString());
    els.share.textContent = `Share link: ${url.toString()}`;
  }

  // ------- DOM -------
  const els = {
    room: document.getElementById("room"),
    create: document.getElementById("create"),
    join: document.getElementById("join"),
    admin: document.getElementById("admin"),
    allow: document.getElementById("allow"),
    reset: document.getElementById("reset"),
    draw: document.getElementById("draw"),
    last: document.getElementById("last"),
    left: document.getElementById("left"),
    role: document.getElementById("role"),
    chatBox: document.getElementById("chat"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    exportMd: document.getElementById("exportMd"),
    purge: document.getElementById("purge"),
    share: document.getElementById("share"),
    end: document.getElementById("end")
  };

  // ------- State -------
  let uid = auth.currentUser?.uid ?? null;
  auth.onAuthStateChanged(u => { uid = u?.uid || null; });

  const rawDeck = await (await fetch(DECK_URL, { cache:"no-store" })).json();
  const norm = c => ({
    id: c.id ?? c.card ?? c.title ?? "Card",
    category: c.category ?? c.cat ?? "Unknown",
    subtitle: c.subtitle ?? c?.meta?.subtitle ?? "",
    hints: Array.isArray(c.hints) ? c.hints :
           (c.hint ? [c.hint] : (Array.isArray(c.meta?.hints) ? c.meta.hints : []))
  });
  const baseDeck = rawDeck.map(norm);

  let roomCode = roomCodeFromUrl();
  if (roomCode) els.room.value = roomCode;
  let roomRef = null;
  let isHypnotist = false;
  let msgsUnsub = null;

  // ------- Create / Join -------
  els.create.onclick = async () => {
    const inputCode = els.room.value.trim();
    roomCode = inputCode || ("tmls-" + Math.random().toString(36).slice(2,6).toUpperCase());
    roomRef = doc(db, "rooms", roomCode);

    if ((await getDoc(roomRef)).exists()) { alert("Room already exists"); return; }
    const deck = shuffle(baseDeck.slice());
    await setDoc(roomRef, {
      hypnotistUid: uid,
      subjectsCanDraw: false,
      deck, deckIndex: 0, lastCard: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ending: false,
      lastActivityAt: serverTimestamp()
    });
    await setSubDoc(doc(collection(roomRef, "participants"), uid), {
      role: "hypnotist", joinedAt: serverTimestamp()
    });

    setUrl(roomCode);
    wireRoom();
  };

  els.join.onclick = async () => {
    roomCode = els.room.value.trim();
    if (!roomCode) { alert("Enter room code"); return; }

    roomRef = doc(db, "rooms", roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) { alert("Room not found"); return; }

    const role = (snap.data().hypnotistUid === uid) ? "hypnotist" : "subject";
    await setSubDoc(doc(collection(roomRef, "participants"), uid), {
      role, joinedAt: serverTimestamp()
    }, { merge:true });

    setUrl(roomCode);
    wireRoom();
  };

  // ------- Realtime wiring -------
  function wireRoom(){
    onSnapshot(roomRef, (snap)=>{
      const d = snap.data(); if (!d) return;
      isHypnotist = (d.hypnotistUid === uid);
      els.admin.style.display = isHypnotist ? "flex" : "none";
      els.allow.checked = !!d.subjectsCanDraw;
      els.last.textContent = d.lastCard ? d.lastCard.id : "—";
      els.left.textContent = d.deck.length - d.deckIndex;
      els.role.textContent = isHypnotist ? "hypnotist" : "subject";
      const locked = d.ending === true;
      els.draw.disabled = locked || ((!isHypnotist && !d.subjectsCanDraw) || (d.deckIndex >= d.deck.length));
      // Wire admin buttons once
      if (els.end && !els.end._wired) { els.end.onclick = terminateSessionClient; els.end._wired = true; }
      if (els.allow && !els.allow._wired) { els.allow.onchange = onToggleAllow; els.allow._wired = true; }
      if (els.reset && !els.reset._wired) { els.reset.onclick = onResetDeck; els.reset._wired = true; }
      if (els.draw && !els.draw._wired) { els.draw.onclick = drawCard; els.draw._wired = true; }
    });

    // chat
    wireChat();

    // best-effort auto-end: mark ending on tab hide (hypnotist only)
    const markEnding = () => {
      if (document.visibilityState === "hidden" && isHypnotist && roomRef) {
        updateDoc(roomRef, { ending: true }).catch(()=>{});
      }
    };
    document.removeEventListener("visibilitychange", markEnding);
    document.addEventListener("visibilitychange", markEnding);
    window.addEventListener("pagehide", () => {
      if (isHypnotist && roomRef) updateDoc(roomRef, { ending: true }).catch(()=>{});
    }, { once: true });
  }

  async function onToggleAllow(e){
    if (!isHypnotist) return;
    await runTransaction(db, async (tx)=>{
      const s = await tx.get(roomRef);
      tx.update(roomRef, {
        subjectsCanDraw: !!e.target.checked,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
      });
    });
  }

  async function onResetDeck(){
    if (!isHypnotist) return;
    await runTransaction(db, async (tx)=>{
      const s = await tx.get(roomRef);
      tx.update(roomRef, {
        deck: shuffle(baseDeck.slice()),
        deckIndex: 0,
        lastCard: null,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
      });
    });
  }

  // ------- Draw (& log to chat) -------
  async function drawCard(){
    let cardDrawn = null;
    await runTransaction(db, async (tx)=>{
      const s = await tx.get(roomRef);
      const d = s.data();
      if (d.ending === true) throw new Error("Session is ending");
      if (d.deckIndex >= d.deck.length) throw new Error("Deck empty");
      cardDrawn = d.deck[d.deckIndex];
      tx.update(roomRef, {
        deckIndex: d.deckIndex + 1,
        lastCard: cardDrawn,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
      });
    });

    await addDoc(collection(roomRef, "messages"), {
      uid,
      role: isHypnotist ? "hypnotist" : "subject",
      type: "card",
      card: {
        id: cardDrawn.id,
        category: cardDrawn.category,
        subtitle: cardDrawn.subtitle,
        hints: cardDrawn.hints
      },
      createdAt: serverTimestamp()
    });
  }

  // ------- Chat -------
  function wireChat(){
    if (msgsUnsub) msgsUnsub();

    const msgsRef = collection(roomRef, "messages");
    const q = query(msgsRef, orderBy("createdAt","asc"));

    msgsUnsub = onSnapMsgs(q, (snap)=>{
      els.chatBox.innerHTML = "";
      snap.forEach(docSnap => els.chatBox.appendChild(renderMsg(docSnap.data())));
      els.chatBox.scrollTop = els.chatBox.scrollHeight;
    });

    els.chatForm.onsubmit = async (e)=>{
      e.preventDefault();
      const text = els.chatInput.value.trim();
      if (!text) return;
      await addDoc(msgsRef, {
        uid,
        role: isHypnotist ? "hypnotist":"subject",
        type:"chat",
        text,
        createdAt: serverTimestamp()
      });
      // bump activity
      updateDoc(roomRef, { lastActivityAt: serverTimestamp() }).catch(()=>{});
      els.chatInput.value = "";
    };

    els.purge.onclick = async ()=>{
      if(!isHypnotist) return;
      if(!confirm("Delete all chat messages in this room?")) return;
      const all = await getDocs(q);
      await Promise.all(all.docs.map(d=>deleteDoc(d.ref)));
    };

    els.exportMd.onclick = exportSessionMarkdown;
  }

  function renderMsg(d){
    const el = document.createElement("div");
    const t = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
    const time = t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (d.type === "card") {
      const hints = (d.card?.hints||[]).map(h=>`• ${esc(h)}`).join("<br>");
      el.innerHTML = `<i>[${time}] ${d.role} drew: <b>${esc(d.card.id)}</b> <span class="tag">(${esc(d.card.category)})</span>${d.card.subtitle?` — ${esc(d.card.subtitle)}`:""}</i>${hints?`<div class="tag">${hints}</div>`:""}`;
    } else {
      const who = d.role === "hypnotist" ? "🜂" : "◆";
      el.innerHTML = `[${time}] <b>${who} ${d.role}</b>: ${esc(d.text)}`;
    }
    return el;
  }

  async function exportSessionMarkdown(){
    const r = await getDoc(roomRef); const room = r.data();
    const msgs = await getDocs(query(collection(roomRef,"messages"), orderBy("createdAt","asc")));
    const lines = [];
    const code = roomCodeFromUrl() || "local";
    lines.push(`# TMLS Play Session — Room ${code}`);
    lines.push(`*Hypnotist can always draw; subjects allowed: **${room.subjectsCanDraw ? "yes" : "no"}***`);
    lines.push("");
    msgs.forEach(m=>{
      const d = m.data();
      const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
      const time = ts.toISOString().slice(11,16);
      if (d.type === "card") {
        lines.push(`> **${time}** — **${cap(d.role)} drew**: **${d.card.id}** _(${d.card.category})_${d.card.subtitle?` — *${d.card.subtitle}*`:""}`);
        if (d.card.hints?.length) d.card.hints.forEach(h=>lines.push(`> - ${h}`));
      } else {
        const who = d.role === "hypnotist" ? "**Hypnotist**" : "*Subject*";
        lines.push(`**${time}** — ${who}: ${d.text}`);
      }
    });
    const md = lines.join("\n");
    const blob = new Blob([md], { type:"text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tmls_session_${code}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }


  async function terminateSessionClient(){
  if (!isHypnotist || !roomRef) return;
  if (!confirm("Really terminate this session? This deletes the room and all chat.")) return;

  let hadError = false;

  // subcollecties in batches
  for (const sub of ['messages','participants']) {
    try {
      const subRef = collection(roomRef, sub);
      while (true) {
        const snap = await getDocs(query(subRef, orderBy('__name__'), /*limit?*/ ));
        if (snap.empty) break;
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        if (snap.size < 200) break; // pas aan als je limit toevoegt
      }
    } catch (e) {
      hadError = true;
      console.error(`[Terminate] Failed deleting ${sub}:`, e);
    }
  }

  // probeer de room zelf altijd te verwijderen
  try {
    await deleteDoc(roomRef);
  } catch (e) {
    hadError = true;
    console.error('[Terminate] Failed deleting room:', e);
    alert('Could not delete room document (check rules & console).');
    return;
  }

  alert(hadError ? 'Session terminated (with some cleanup errors — see console).'
                 : 'Session terminated.');
  location.href = "./";
}


  console.log("[TMLS] Viewer ready. Deck size:", baseDeck.length);
})();

/* Deck picker bootstrap (only valid decks; silent in prod on invalid) */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { mountDeckPicker(); });
} else {
  mountDeckPicker();
}

// --- Bootstrap Firebase auth + deck picker on homepage ---
(function bootstrapHomepage() {
  // If your firebase config lives on window.FIREBASE_CONFIG or imported elsewhere, adapt here:
  const cfg = globalThis.FIREBASE_CONFIG || null;
  if (!cfg) return; // no firebase, skip

  const app = initializeApp(cfg);
  setupAppCheck(app, globalThis.FIREBASE_RECAPTCHA_SITE_KEY || "");
  ensureAnonAuth(app).catch(() => {});

  // Wire buttons if present
  const btnStart = document.getElementById('btn-start-session');
  const btnJoin  = document.getElementById('btn-join-room');
  const inputCode = document.getElementById('room-code') || document.querySelector('input[name="room"]');

  if (btnStart && inputCode) {
    btnStart.addEventListener('click', async () => {
      const code = (inputCode.value || '').trim() || Math.random().toString(36).slice(2,7);
      try {
        await createRoom({ code, hostUid: (globalThis.CURRENT_USER_UID || 'anon') });
        location.href = `/room.html?room=${encodeURIComponent(code)}`;
      } catch (e) {
        if (import.meta.env.DEV) console.warn('start session failed', e);
      }
    });
  }
  if (btnJoin && inputCode) {
    btnJoin.addEventListener('click', async () => {
      const code = (inputCode.value || '').trim();
      if (!code) return;
      try {
        await joinRoom({ code, uid: (globalThis.CURRENT_USER_UID || 'anon') });
        location.href = `/room.html?room=${encodeURIComponent(code)}`;
      } catch (e) {
        if (import.meta.env.DEV) console.warn('join failed', e);
      }
    });
  }

  // Mount deck picker (shows only valid decks)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { mountDeckPicker(); });
  } else {
    mountDeckPicker();
  }
})();
