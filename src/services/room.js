// src/services/room.js
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";

/**
 * Room aanmaken (creator = hypnotist) + eigen participant-doc
 */
export async function createRoom({ roomCode, hypnotistUid }) {
  const ref = doc(db, "rooms", roomCode);
  await setDoc(ref, {
    hypnotistUid,
    deckIndex: 0,
    subjectsCanDraw: false,
    ending: false,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "rooms", roomCode, "participants", hypnotistUid), {
    uid: hypnotistUid,
    role: "hypnotist",
    displayName: "Host",
    lastActiveAt: serverTimestamp(),
    isTyping: false,
  });
  return ref;
}

/**
 * Room joinen (rol afleiden tov host)
 */
export async function joinRoom({ roomCode, uid, displayName }) {
  const r = await getDoc(doc(db, "rooms", roomCode));
  if (!r.exists()) throw new Error("Room not found");
  await setDoc(
    doc(db, "rooms", roomCode, "participants", uid),
    {
      uid,
      role: uid === r.data().hypnotistUid ? "hypnotist" : "subject",
      displayName: displayName || "Guest",
      lastActiveAt: serverTimestamp(),
      isTyping: false,
    },
    { merge: true }
  );
}

/**
 * Presence heartbeat (alleen ok zolang rules het toestaan)
 */
export function heartbeat({ roomCode, uid }) {
  return updateDoc(doc(db, "rooms", roomCode, "participants", uid), {
    lastActiveAt: serverTimestamp(),
  });
}

/**
 * Typing flag togglen
 */
export async function setTyping({ roomCode, uid, isTyping }) {
  await updateDoc(doc(db, "rooms", roomCode, "participants", uid), {
    isTyping,
  });
}

/**
 * Live chat stream
 */
export function onMessages(roomCode, cb) {
  const q = query(
    collection(db, "rooms", roomCode, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

/**
 * Live participants stream
 */
export function onParticipants(roomCode, cb) {
  const col = collection(db, "rooms", roomCode, "participants");
  return onSnapshot(col, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

/**
 * Live room doc (voor bv. ending==true → heartbeat stoppen)
 */
export function onRoom(roomCode, cb) {
  return onSnapshot(doc(db, "rooms", roomCode), (snap) =>
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

/**
 * Room beëindigen (host-actie) + system message
 */
export async function endRoom({ roomCode, uid }) {
  const r = doc(db, "rooms", roomCode);
  await updateDoc(r, { ending: true });
  await sendMessage({
    roomCode,
    uid,
    text: "Room ended by host",
    type: "system",
  });
}

/**
 * (Optioneel) Events API — voor gesynchroniseerde tafel-acties
 * action: 'draw' | 'reveal' | 'shuffle' | 'flip' | 'reset'
 */
export async function addEvent({ roomCode, uid, action, payload = {} }) {
  const ref = collection(db, "rooms", roomCode, "events");
  await addDoc(ref, { uid, action, payload, createdAt: serverTimestamp() });
}

export function onEvents(roomCode, cb) {
  const q = query(
    collection(db, "rooms", roomCode, "events"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

// --- Phase-2C.1 wrapper (keeps legacy imports working) ---
export { sendMessage } from './room.api.js';

export { subscribeMessages } from './room.api.js';
