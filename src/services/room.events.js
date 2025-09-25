const listeners = new Map(); // event -> Set<fn>

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}
export function off(event, handler) {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(handler);
  if (set.size === 0) listeners.delete(event);
}
export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch { /* no-op */ }
  }
}
export const addEvent = (p) => emit('event', p);
export const onEvents = (h) => on('event', h);
