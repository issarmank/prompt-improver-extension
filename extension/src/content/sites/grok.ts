// Site adapter for grok.com. See NOTES.md ("grok.com") for the DOM research.
import { readParagraphText, setContentEditableText } from './contenteditable';
import { setTextareaText } from './textarea';
import type { SiteAdapter } from './types';
import { leftOfInput } from '../ui/positioning';

const TIPTAP_SELECTOR = 'div.tiptap.ProseMirror[contenteditable="true"]';
const LEGACY_TEXTAREA_SELECTOR = 'textarea[aria-label="Ask Grok anything"]';

export const grokAdapter: SiteAdapter = {
  siteId: 'grok',
  positionButton: leftOfInput(60, -6),

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(TIPTAP_SELECTOR) ??
      document.querySelector<HTMLElement>(LEGACY_TEXTAREA_SELECTOR)
    );
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
