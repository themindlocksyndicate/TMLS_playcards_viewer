/**
 * Services barrel.
 * Keeps legacy exports as-is (via './room.js'), and offers structured entry points:
 *  - api: Firestore-facing operations (currently forwarded to legacy)
 *  - events: lightweight event bus ready for adoption
 */
export * from './room.js';             // legacy surface unchanged
export * as api from './room.api.js';  // new: structured API facade
export * as events from './room.events.js'; // new: event bus
