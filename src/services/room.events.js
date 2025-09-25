/**
 * Minimal event bus for room-level events.
 * Non-breaking: your existing room.js events keep working; this is ready for gradual migration.
 */
const listeners = new Map(); // event -> Set<fn>

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  const set = listeners.get(event);
  if (set) {
    set.delete(handler);
    if (set.size === 0) listeners.delete(event);
  }
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch (_) { /* no-op */ }
  }
}

/** Optional shims for familiar naming used in the UI */
export const addEvent = (payload) => emit('event', payload);
export const onEvents  = (handler) => on('event', handler);
