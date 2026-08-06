// Keeps the button parked in the site's action row. The sites re-render their
// composer constantly and swap it wholesale on a route change, so mounting is
// expressed as one idempotent function that any signal can call: it either puts
// the node exactly where the adapter says, or takes it out of the page.
import type { ButtonSlot } from '../sites/types';

/**
 * The control to copy colour and font from — a real button in the group we are
 * inserting next to, so the pill matches the row's rendered text, not whatever
 * the row happens to inherit.
 */
export function styleSourceFor(slot: ButtonSlot): Element | null {
  const scope = slot.before ?? slot.container;
  const control = scope.querySelector('button, [role="button"]');
  if (control) return control;
  return scope.matches('button, [role="button"]') ? scope : slot.container;
}

/**
 * Insert `host` at `slot`, or do nothing if it is already there. Returns true
 * when the DOM was actually touched, so the caller can skip the work that only
 * matters on a real (re)mount.
 */
export function applySlot(host: HTMLElement, slot: ButtonSlot): boolean {
  // A stale `before` from a half-replaced row would throw in insertBefore.
  const before = slot.before?.parentElement === slot.container ? slot.before : null;
  if (host.parentElement === slot.container && host.nextElementSibling === before) return false;
  slot.container.insertBefore(host, before);
  return true;
}
