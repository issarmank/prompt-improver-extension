// Reusable placement strategies for the Improve button. Sites compose these
// (or write their own PositionButton function) to fit their own DOM.
import type { PositionButton } from '../sites/types';

const SCREEN_EDGE_MARGIN = 4;
const MAX_ANCESTOR_WALK = 8;

/** The rectangle of `input` that the user can actually see, in viewport pixels. */
export interface VisibleBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Intersects the input's rect with every clipping ancestor above it.
 *
 * ProseMirror (chatgpt, claude) and Quill (gemini) grow the contenteditable to
 * the full height of its content and let an ancestor cap it with a max-height
 * and scroll. So as soon as the prompt is long enough to scroll, the input's
 * own rect is much taller than the composer — often running off the bottom of
 * the viewport — and its midpoint slides further down with every line added.
 * The clipped box is what the user sees, and it stops changing once the
 * composer hits its max height, so centering on it keeps the button still.
 */
export function visibleBox(input: HTMLElement): VisibleBox {
  const rect = input.getBoundingClientRect();
  let { top, bottom, left, right } = rect;

  let el = input.parentElement;
  for (let i = 0; el && el !== document.body && i < MAX_ANCESTOR_WALK; i++) {
    const style = getComputedStyle(el);
    // CSS forces both axes to a non-visible value when either one is set, so
    // testing overflowY alone is enough to spot a clipping ancestor.
    if (style.overflowY !== 'visible') {
      const r = el.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
      left = Math.max(left, r.left);
      right = Math.min(right, r.right);
    }
    el = el.parentElement;
  }

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Places the button to the left of the input, vertically centered on the
 * input's *visible* box (see `visibleBox` — the raw rect drifts as the editor
 * grows). `gap` is the horizontal distance from the box's left edge;
 * `verticalOffset` shifts up (positive) or down (negative) from center.
 * Clamps so the button never goes off-screen.
 */
export function leftOfInput(gap: number, verticalOffset: number): PositionButton {
  return (input, { width, height }) => {
    const box = visibleBox(input);
    const maxTop = Math.max(SCREEN_EDGE_MARGIN, window.innerHeight - height - SCREEN_EDGE_MARGIN);
    return {
      // Round to whole pixels: subpixel rect changes otherwise make the button
      // shimmer by a fraction of a pixel on every keystroke.
      top: Math.round(
        Math.min(
          Math.max(box.top + box.height / 2 - height / 2 - verticalOffset, SCREEN_EDGE_MARGIN),
          maxTop,
        ),
      ),
      left: Math.round(Math.max(box.left - width - gap, SCREEN_EDGE_MARGIN)),
    };
  };
}
