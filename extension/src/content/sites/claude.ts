// Site adapter for claude.ai. See NOTES.md ("claude.ai") for the DOM research.
import { readParagraphText, setContentEditableText } from './contenteditable';
import type { SiteAdapter } from './types';
import { leftOfInput } from '../ui/positioning';

const ARIA_SELECTOR =
  'div[aria-label="Write your prompt to Claude"][contenteditable="true"]';
const FALLBACK_SELECTOR = 'div.ProseMirror[contenteditable="true"]';

export const claudeAdapter: SiteAdapter = {
  siteId: 'claude',
  positionButton: leftOfInput(30, -26),

  findInputElement(): HTMLElement | null {
    const byLabel = document.querySelector<HTMLElement>(ARIA_SELECTOR);
    if (byLabel) return byLabel;
    // Editing a previous message spawns extra ProseMirror instances above the
    // main composer, which renders last — take the last match.
    const all = document.querySelectorAll<HTMLElement>(FALLBACK_SELECTOR);
    return all.length > 0 ? all[all.length - 1]! : null;
  },

  getText(el: HTMLElement): string {
    return readParagraphText(el);
  },

  setText(el: HTMLElement, text: string): void {
    setContentEditableText(el, text);
  },
};
