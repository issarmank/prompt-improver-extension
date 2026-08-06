// Site adapter for gemini.google.com. See NOTES.md ("gemini.google.com").
import { readParagraphText, setContentEditableText } from './contenteditable';
import type { SiteAdapter } from './types';
import { leftOfInput } from '../ui/positioning';

const PRIMARY_SELECTOR = 'rich-textarea .ql-editor[contenteditable="true"]';
const FALLBACK_SELECTOR = 'div.ql-editor[contenteditable="true"]';

export const geminiAdapter: SiteAdapter = {
  siteId: 'gemini',
  positionButton: leftOfInput(70, 0),

  findInputElement(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>(PRIMARY_SELECTOR) ??
      document.querySelector<HTMLElement>(FALLBACK_SELECTOR)
    );
  },

  getText(el: HTMLElement): string {
    return readParagraphText(el);
  },

  setText(el: HTMLElement, text: string): void {
    setContentEditableText(el, text);
  },
};
