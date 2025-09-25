/**
 * Services barrel.
 * - legacy surface via './room.js'
 * - new API via './room.api.js'
 * - events bus via './room.events.js'
 */
export * from './room.js';
export * as api    from './room.api.js';
export * as events from './room.events.js';
