// Site adapter for grok.com. See NOTES.md ("grok.com") for the DOM research.
import { readParagraphText, setContentEditableText } from './contenteditable';
import { slotLeftOf } from './slot';
import { setTextareaText } from './textarea';
import type { ButtonSlot, SiteAdapter } from './types';

const TIPTAP_SELECTOR = 'div.tiptap.ProseMirror[contenteditable="true"]';
const LEGACY_TEXTAREA_SELECTOR = 'textarea[aria-label="Ask Grok anything"]';

// The button sits to the left of the model/speed pill ("Fast", "Expert") in the
// composer's bottom row, which also carries attach, dictation and voice mode.
const LANDMARKS = ['button[aria-label*="Model select" i]', 'button[aria-label*="model" i]'];

export const grokAdapter: SiteAdapter = {
  siteId: 'grok',

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(TIPTAP_SELECTOR) ??
      document.querySelector<HTMLElement>(LEGACY_TEXTAREA_SELECTOR)
    );
  },

  findButtonSlot(input: HTMLElement): ButtonSlot | null {
    return slotLeftOf(input, LANDMARKS);
  },

  getText(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement) return el.value;
    return readParagraphText(el);
  },

  setText(el: HTMLElement, text: string): void {
    if (el instanceof HTMLTextAreaElement) {
      setTextareaText(el, text);
    } else {
      setContentEditableText(el, text);
    }
  },
};
