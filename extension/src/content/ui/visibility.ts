// Decides whether a resolved composer is one the user can actually type into
// *right now*. Finding the element is not enough: every one of these sites is
// a SPA that opens settings as a modal over the chat, or leaves the chat
// mounted but hidden after a route change, and the selectors keep matching it.
//
// Since the button now lives inside the composer's own action row, a composer
// that is clipped, scrolled away or covered takes the button with it — so this
// only has to catch the case where the composer is still *rendered* while the
// user is looking at something else.

// Radix (chatgpt, claude) marks everything outside an open modal with
// aria-hidden/inert, which is the most reliable "this is behind an overlay"
// signal there is — it is set on an ancestor of the composer, not the modal.
const HIDDEN_ANCESTOR_SELECTOR = '[inert], [aria-hidden="true"]';

/**
 * True when `input` is on screen and usable. Cheap enough to call on every
 * mount check: one `closest()`, one computed style and one rect.
 */
export function isInputInteractive(input: HTMLElement): boolean {
  if (!input.isConnected) return false;
  if (input.closest(HIDDEN_ANCESTOR_SELECTOR)) return false;

  const style = getComputedStyle(input);
  // `visibility` is inherited, so the element's own computed value already
  // accounts for a hidden ancestor.
  if (style.display === 'none' || style.visibility !== 'visible') return false;

  // display:none anywhere above collapses the rect to nothing.
  const rect = input.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
