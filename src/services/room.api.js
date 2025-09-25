import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * API layer (Phase 2C.x)
 * We define new API-owned functions hier, zonder legacy re-export.
 * Legacy blijft via room.js of via the barrel (services/index.js).
 */

/**
 * Send a chat message to a room.
 * @param {{roomCode:string, uid:string, text:string}} p
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
