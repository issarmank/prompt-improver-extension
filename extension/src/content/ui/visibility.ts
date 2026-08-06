// Decides whether a resolved composer is one the user can actually type into
// *right now*. Finding the element is not enough: every one of these sites is
// a SPA that opens settings (and other sections) as a modal over the chat, or
// leaves the chat mounted but hidden after a route change. In both cases the
// composer stays in the DOM and the selectors keep matching it, so the button
// would float over an unrelated screen.
import { visibleBox } from './positioning';

// Radix (chatgpt, claude) marks everything outside an open modal with
// aria-hidden/inert, which is the most reliable "this is behind an overlay"
// signal there is — it is set on an ancestor of the composer, not the modal.
const HIDDEN_ANCESTOR_SELECTOR = '[inert], [aria-hidden="true"]';

// Fallback for overlays that don't inert the page behind them.
const MODAL_SELECTOR = '[aria-modal="true"], dialog[open]';

function hasLayout(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** True when a modal is open and the composer is not inside it. */
function isBehindModal(input: HTMLElement): boolean {
  for (const modal of document.querySelectorAll<HTMLElement>(MODAL_SELECTOR)) {
    if (modal.contains(input)) continue;
    if (getComputedStyle(modal).display === 'none') continue;
    if (hasLayout(modal)) return true;
  }
  return false;
}

/**
 * True when `input` is on screen and usable. Cheap enough to call on every
 * reposition: one `closest()`, one computed style, and the rect walk the
 * positioner needs anyway.
 */
export function isInputInteractive(input: HTMLElement): boolean {
  if (!input.isConnected) return false;
  if (input.closest(HIDDEN_ANCESTOR_SELECTOR)) return false;

  const style = getComputedStyle(input);
  // `visibility` is inherited, so the element's own computed value already
  // accounts for a hidden ancestor.
  if (style.display === 'none' || style.visibility !== 'visible') return false;

  // display:none anywhere above collapses the rect to nothing, and a composer
  // scrolled fully out of its clipping ancestor has no visible box either.
  const box = visibleBox(input);
  if (box.width <= 0 || box.height <= 0) return false;

  return !isBehindModal(input);
}