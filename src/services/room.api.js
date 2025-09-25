// API facade (Phase 2C, step 1): keep behavior by forwarding to legacy room.js.
// Later PRs will replace these with focused Firestore ops (join/leave/send/etc).
export * from './room.js'; // <- legacy export surface retained 1:1

import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Send a chat/message to the given room.
 * Safe API: takes { roomCode, uid, text }.
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
