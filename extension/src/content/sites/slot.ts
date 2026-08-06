// Shared slot resolution. Every site lays its composer out differently, but the
// action row is always reachable the same way: find a control that is always
// there (the model picker, the mic, the attach button), then climb to the flex
// row that holds it. Hashed class names are never used as landmarks — chatgpt,
// claude, grok and deepseek all rewrite them on deploy.
import type { ButtonSlot } from './types';

/** How far above the input we widen the landmark search / climb the row. */
const MAX_DEPTH = 8;

/**
 * Find `selector` in the composer subtree around `input`, widening the search
 * one ancestor at a time. Scoping it this way keeps a landmark from matching
 * an identical control elsewhere on the page (a header model picker, a file
 * input in a modal).
 */
export function findInComposer(
  input: HTMLElement,
  selector: string,
  maxDepth = MAX_DEPTH,
): HTMLElement | null {
  let scope = input.parentElement;
  for (let i = 0; i < maxDepth && scope && scope !== document.body; i += 1) {
    const hit = scope.querySelector<HTMLElement>(selector);
    if (hit && hit !== input && !hit.contains(input)) return hit;
    scope = scope.parentElement;
  }
  return null;
}

/**
 * A group of controls laid out side by side. Both halves matter: the child
 * count rejects the single-child popover anchors these UIs wrap every dropdown
 * in, and the direction rejects gemini's mode picker, whose immediate parent is
 * a *column* holding the button and its popover.
 */
function isActionRow(el: HTMLElement): boolean {
  if (el.childElementCount < 2) return false;
  const style = getComputedStyle(el);
  if (!style.display.includes('flex') && !style.display.includes('grid')) return false;
  return !style.flexDirection.startsWith('column');
}

/**
 * The action row holding `landmark`: the *innermost* group of side-by-side
 * controls that doesn't also contain the editor. Innermost is what keeps the
 * button next to its landmark — grok's model pill sits in an `ms-auto` group,
 * so inserting into the outer row would push the button to the far left of the
 * composer instead of up against the pill.
 */
export function actionRowFrom(landmark: Element, input: HTMLElement): HTMLElement | null {
  let el = landmark.parentElement;
  let nearest: HTMLElement | null = null;
  for (let i = 0; i < MAX_DEPTH && el && el !== document.body; i += 1) {
    if (el.contains(input)) break;
    // A row of one is still a row — a build that hides every other control in
    // the group should put the button beside the one that is left, not nowhere.
    nearest ??= el;
    if (isActionRow(el)) return el;
    el = el.parentElement;
  }
  return nearest;
}

/** The direct child of `container` that is, or contains, `node`. */
export function directChildContaining(container: Element, node: Element): HTMLElement | null {
  let el: Element | null = node;
  while (el && el.parentElement !== container) el = el.parentElement;
  return el instanceof HTMLElement ? el : null;
}

/**
 * Resolve a slot that puts the button immediately to the left of the first
 * landmark that matches, in that landmark's own row. Selectors are tried in
 * order, so a site can list a stable test id first and a localized aria-label
 * as the fallback.
 */
export function slotLeftOf(input: HTMLElement, selectors: string[]): ButtonSlot | null {
  for (const selector of selectors) {
    const landmark = findInComposer(input, selector);
    if (!landmark) continue;
    const container = actionRowFrom(landmark, input);
    if (!container) continue;
    const before = directChildContaining(container, landmark);
    if (!before) continue;
    return { container, before };
  }
  return null;
}
