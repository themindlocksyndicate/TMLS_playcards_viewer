// API facade (Phase 2C, step 1): keep behavior by forwarding to legacy room.js.
// Later PRs will replace these with focused Firestore ops (join/leave/send/etc).
export * from './room.js'; // <- legacy export surface retained 1:1
