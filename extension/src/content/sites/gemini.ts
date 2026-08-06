// Site adapter for gemini.google.com. See NOTES.md ("gemini.google.com").
import { readParagraphText, setContentEditableText } from './contenteditable';
import { slotLeftOf } from './slot';
import type { ButtonSlot, SiteAdapter } from './types';

const PRIMARY_SELECTOR = 'rich-textarea .ql-editor[contenteditable="true"]';
const FALLBACK_SELECTOR = 'div.ql-editor[contenteditable="true"]';

// The button sits to the left of the mode picker, inside
// `.trailing-actions-wrapper` — the grid column the composer already reserves
// for the picker and the mic, so no layout of ours is involved.
const LANDMARKS = [
  'bard-mode-switcher',
  '.model-picker-container',
  'button[aria-label*="mode picker" i]',
];

export const geminiAdapter: SiteAdapter = {
  siteId: 'gemini',

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(PRIMARY_SELECTOR) ??
      document.querySelector<HTMLElement>(FALLBACK_SELECTOR)
    );
  },

  findButtonSlot(input: HTMLElement): ButtonSlot | null {
    return slotLeftOf(input, LANDMARKS);
  },

  getText(el: HTMLElement): string {
    return readParagraphText(el);
  },

  setText(el: HTMLElement, text: string): void {
    setContentEditableText(el, text);
  },
};
