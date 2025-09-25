import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit as qLimit,
  onSnapshot,
} from 'firebase/firestore';

/**
 * API layer (Phase 2C)
 * New API-owned functions live here (no legacy re-export).
 * Legacy surface stays via room.js wrappers / services barrel.
 */

/** Send a chat message to a room. */
export async function sendMessage({ roomCode, uid, text }) {
  const db = getFirestore();
  const ref = collection(db, 'rooms', roomCode, 'messages');
  return await addDoc(ref, { uid, text, created: serverTimestamp() });
}

/** Subscribe to messages; handler(items, snapshot). */
export function subscribeMessages(roomCode, handler, opts = {}) {
  const { limit = 200, order = 'asc' } = opts;
  const db  = getFirestore();
  const col = collection(db, 'rooms', roomCode, 'messages');
  const q   = query(
    col,
    orderBy('created', order === 'desc' ? 'desc' : 'asc'),
    qLimit(typeof limit === 'number' && limit > 0 ? limit : 200)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    try { handler(items, snap); } catch {}
  });
}
