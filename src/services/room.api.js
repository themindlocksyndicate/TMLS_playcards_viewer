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
 * Legacy imports keep working via room.js wrapper exports.
 */

/**
 * Send a chat message to a room.
 * @param {{ roomCode: string, uid: string, text: string }} p
 */
export async function sendMessage({ roomCode, uid, text }) {
  const db = getFirestore();
  const ref = collection(db, 'rooms', roomCode, 'messages');
  return await addDoc(ref, {
    uid,
    text,
    created: serverTimestamp(),
  });
}

/**
 * Subscribe to room messages via Firestore onSnapshot.
 * Backward-friendly: handler(items, snapshot) — one-arg handlers still fine.
 * @param {string} roomCode
 * @param {(items: any[], snap: import('firebase/firestore').QuerySnapshot)=>void} handler
 * @param {{limit?:number, order?:'asc'|'desc'}} [opts]
 * @returns {() => void} unsubscribe
 */
export function subscribeMessages(roomCode, handler, opts = {}) {
  const { limit = 200, order = 'asc' } = opts;
  const db = getFirestore();
  const col = collection(db, 'rooms', roomCode, 'messages');

  const q = query(
    col,
    orderBy('created', order === 'desc' ? 'desc' : 'asc'),
    qLimit(typeof limit === 'number' && limit > 0 ? limit : 200)
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    try { handler(items, snap); } catch { /* no-op */ }
  });
}
