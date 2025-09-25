/**
 * Services barrel.
 * Keeps legacy exports as-is (via './room.js'),
 * and offers structured entry points:
 *  - api: Firestore-facing operations
 *  - events: lightweight event bus
 */
export * from './room.js';              // legacy surface unchanged
export * as api from './room.api.js';   // new structured API
export * as events from './room.events.js'; // new event bus
