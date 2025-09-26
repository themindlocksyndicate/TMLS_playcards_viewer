import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit as qLimit,
  onSnapshot,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

/** ---------------- Chat API ---------------- **/

export async function sendMessage({ roomCode, uid, text }) {
  const db = getFirestore();
  const ref = collection(db, 'rooms', roomCode, 'messages');
  return await addDoc(ref, { uid, text, created: serverTimestamp() });
}

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
    try { handler(items, snap); } catch { /* no-op */ }
  });
}

/** ---------------- Room API ---------------- **/

export async function createRoom({ code, hostUid }) {
  const db = getFirestore();
  const ref = doc(db, 'rooms', code);
  await setDoc(ref, { code, hostUid, created: serverTimestamp() }, { merge: true });
  return { code };
}

export async function joinRoom({ code, uid }) {
  const db = getFirestore();
  const ref = doc(db, 'rooms', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Room not found');
  return { code, uid };
}
