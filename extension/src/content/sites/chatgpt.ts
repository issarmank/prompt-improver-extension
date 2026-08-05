// Site adapter for chatgpt.com. See NOTES.md ("chatgpt.com") for the DOM
// research behind these selectors and event tricks.
import type { SiteAdapter } from './types';

const INPUT_SELECTOR = '#prompt-textarea';

export const chatgptAdapter: SiteAdapter = {
  siteId: 'chatgpt',

  findInputElement(): HTMLElement | null {
    return document.querySelector<HTMLElement>(INPUT_SELECTOR);
  },

  getText(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement) return el.value;
    // ProseMirror keeps one <p> per line; the placeholder <p> is empty.
    const paragraphs = el.querySelectorAll('p');
    if (paragraphs.length === 0) return el.textContent ?? '';
    return Array.from(paragraphs)
      .map((p) => p.textContent ?? '')
      .join('\n');
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

/**
 * ProseMirror ignores direct textContent writes. execCommand('insertText')
 * over a select-all produces the native beforeinput/input sequence it does
 * listen to. If execCommand is unavailable, rebuild the paragraphs and
 * synthesize a bubbling InputEvent for React's delegated onInput.
 */
function setContentEditableText(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument;
  el.focus();

  try {
    doc.defaultView?.getSelection()?.selectAllChildren(el);
  } catch {
    // jsdom's Selection support is partial; the fallback path covers it.
  }

  let inserted = false;
  if (typeof doc.execCommand === 'function') {
    try {
      inserted = doc.execCommand('insertText', false, text) === true;
    } catch {
      inserted = false;
    }
  }
  if (inserted) return;

  el.replaceChildren(
    ...text.split('\n').map((line) => {
      const p = doc.createElement('p');
      p.textContent = line;
      return p;
    }),
  );
  el.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }),
  );
}
