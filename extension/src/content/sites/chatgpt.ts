// Site adapter for chatgpt.com. See NOTES.md ("chatgpt.com") for the DOM
// research behind these selectors and event tricks.
import { readParagraphText, setContentEditableText } from './contenteditable';
import { slotLeftOf } from './slot';
import { setTextareaText } from './textarea';
import type { ButtonSlot, SiteAdapter } from './types';

const INPUT_SELECTOR = '#prompt-textarea';

// The button sits to the left of the microphone. There is no bottom toolbar on
// this build — the composer is one grid row (leading | editor | trailing), so
// the mic and send live in a small trailing flex row and we prepend to it.
// The send button is the fallback landmark for builds that hide dictation.
const LANDMARKS = [
  '[data-testid="composer-speech-button"]',
  'button[aria-label*="dictation" i]',
  'button[aria-label*="voice" i]',
  '[data-testid="send-button"]',
];

export const chatgptAdapter: SiteAdapter = {
  siteId: 'chatgpt',

  findInputElement(): HTMLElement | null {
    return document.querySelector<HTMLElement>(INPUT_SELECTOR);
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
