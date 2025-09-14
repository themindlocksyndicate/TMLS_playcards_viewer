// app.js (pure JS – no HTML!)
import {
  doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp,
  collection, setDoc as setSubDoc, addDoc, query, orderBy,
  onSnapshot as onSnapMsgs, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const { db, auth } = window.tmls;
let uid = auth.currentUser?.uid ?? null;
auth.onAuthStateChanged(u => { uid = u?.uid || null; });

const DECK_URL = "https://themindlocksyndicate.github.io/TMLS_playcards_datasets/datasets/cards.json";
const baseDeck = await (await fetch(DECK_URL, { cache: "no-store" })).json();

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

// minimal wire-up just to pass build; keep your full version here:
console.log("TMLS viewer loaded. Deck size:", baseDeck.length);
