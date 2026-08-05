// Site adapter for chatgpt.com. See NOTES.md ("chatgpt.com") for the DOM
// research behind these selectors and event tricks.
import { readParagraphText, setContentEditableText } from './contenteditable';
import type { SiteAdapter } from './types';

const INPUT_SELECTOR = '#prompt-textarea';

export const chatgptAdapter: SiteAdapter = {
  siteId: 'chatgpt',

  findInputElement(): HTMLElement | null {
    return document.querySelector<HTMLElement>(INPUT_SELECTOR);
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

/**
 * React overrides `value` per element to track user input, so a plain
 * assignment is invisible to it. Writing through the native prototype setter
 * and then firing a bubbling input event makes React re-read the value.
 */
function setTextareaText(el: HTMLTextAreaElement, text: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
