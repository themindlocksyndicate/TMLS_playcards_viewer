// app.js — no top-level await

import {
  doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp,
  collection, setDoc as setSubDoc, addDoc, query, orderBy,
  onSnapshot as onSnapMsgs, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

(async function main() {

  // Session lifetime in milliseconds (change this one value)
  const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const SESSION_REFRESH_MS = 30 * 60 * 1000; // optional auto-extend window (30 min)
  
  // wait for Firebase anon sign-in from index.html
  const { auth, db } = await window.tmls.ready;

  const DECK_URL = "https://themindlocksyndicate.github.io/TMLS_playcards_datasets/datasets/cards.json";
  const rawDeck = await (await fetch(DECK_URL, { cache: "no-store" })).json();

  const norm = c => ({
    id: c.id ?? c.card ?? c.title ?? "Card",
    category: c.category ?? c.cat ?? "Unknown",
    subtitle: c.subtitle ?? c?.meta?.subtitle ?? "",
    hints: Array.isArray(c.hints) ? c.hints :
           (c.hint ? [c.hint] : (Array.isArray(c.meta?.hints) ? c.meta.hints : []))
  });
  const baseDeck = rawDeck.map(norm);

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
    share: document.getElementById("share")
  };

  let uid = auth.currentUser?.uid ?? null;
  auth.onAuthStateChanged(u => { uid = u?.uid || null; });

  let roomCode = roomCodeFromUrl();
  if (roomCode) els.room.value = roomCode;
  let roomRef = null;
  let isHypnotist = false;
  let msgsUnsub = null;

  // create
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
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await setSubDoc(doc(collection(roomRef, "participants"), uid), {
      role: "hypnotist", joinedAt: serverTimestamp()
    });

    setUrl(roomCode);
    wireRoom();
  };

  // join
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

  function wireRoom(){
    onSnapshot(roomRef, (snap)=>{
      const d = snap.data(); if (!d) return;
      isHypnotist = (d.hypnotistUid === uid);
      els.admin.style.display = isHypnotist ? "flex" : "none";
      els.allow.checked = !!d.subjectsCanDraw;
      els.last.textContent = d.lastCard ? d.lastCard.id : "—";
      els.left.textContent = d.deck.length - d.deckIndex;
      els.role.textContent = isHypnotist ? "hypnotist" : "subject";
      els.draw.disabled = (!isHypnotist && !d.subjectsCanDraw) || (d.deckIndex >= d.deck.length);
    });

    // admin
    els.allow.onchange = async (e)=>{
      if (!isHypnotist) return;
      await runTransaction(db, async (tx)=>{
        const s = await tx.get(roomRef);
        tx.update(roomRef, { subjectsCanDraw: !!e.target.checked, updatedAt: serverTimestamp() });
      });
    };
    els.reset.onclick = async ()=>{
      if (!isHypnotist) return;
      await runTransaction(db, async (tx)=>{
        const s = await tx.get(roomRef);
        tx.update(roomRef, {
          deck: shuffle(baseDeck.slice()),
          deckIndex: 0,
          lastCard: null,
          updatedAt: serverTimestamp()
        });
      });
    };

    // draw
    els.draw.onclick = drawCard;

    // chat
    wireChat();
  }

  async function drawCard(){
    let cardDrawn = null;
    await runTransaction(db, async (tx)=>{
      const s = await tx.get(roomRef);
      const d = s.data();
      if (d.deckIndex >= d.deck.length) throw new Error("Deck empty");
      cardDrawn = d.deck[d.deckIndex];
      tx.update(roomRef, {
        deckIndex: d.deckIndex + 1,
        lastCard: cardDrawn,
        updatedAt: serverTimestamp()
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
      await addDoc(msgsRef, { uid, role: isHypnotist ? "hypnotist":"subject", type:"chat", text, createdAt: serverTimestamp() });
      els.chatInput.value = "";
    };

    els.purge.onclick = async ()=>{
      if (!isHypnotist) return;
      if (!confirm("Delete all chat messages in this room?")) return;
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

  console.log("[TMLS] Viewer ready. Deck size:", baseDeck.length);
})();
