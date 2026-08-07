// Site adapter for chat.deepseek.com. See NOTES.md ("chat.deepseek.com").
import { readParagraphText, setContentEditableText } from './contenteditable';
import { actionRowFrom, directChildContaining, findInComposer, slotLeftOf } from './slot';
import { setTextareaText } from './textarea';
import type { ButtonSlot, SiteAdapter } from './types';

// DeepSeek's hashed class names churn on every deploy, so match on the id
// (older builds), placeholder (current builds), then the semantic wrapper
// class. The placeholder is locale-dependent, hence the other two.
const SELECTORS = [
  'textarea#chat-input',
  'textarea[placeholder="Message DeepSeek"]',
  '[class*="chat-input"] textarea',
];

// The button sits to the left of the attach button, at the right end of the
// footer row that starts with DeepThink and Search. Nothing here is labelled —
// every control is a hashed `div[role="button"]` — so the attach button is
// identified by the hidden file input sitting alongside it in the same group.
const ATTACH_GROUP = 'input[type="file"]';
/** Last resort if the file input moves out of the group: aim at the send button. */
const FALLBACK_LANDMARKS = ['div[role="button"]:last-of-type'];

/**
 * The attach control: the first real control in the group holding the file
 * input. Current builds put the file input directly in the action row, so once
 * our button is docked it is the first `button` in that group — skip anything
 * of ours or the slot resolves to our own node and remounts forever.
 */
function findAttachButton(input: HTMLElement): HTMLElement | null {
  const file = findInComposer(input, ATTACH_GROUP);
  if (!file?.parentElement) return null;
  for (const el of file.parentElement.querySelectorAll<HTMLElement>('button, [role="button"]')) {
    if (!el.closest('[data-prompt-polish]')) return el;
  }
  return null;
}

export const deepseekAdapter: SiteAdapter = {
  siteId: 'deepseek',

  findInputElement(): HTMLElement | null {
    for (const selector of SELECTORS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    }
    return null;
  },

  findButtonSlot(input: HTMLElement): ButtonSlot | null {
    const attach = findAttachButton(input);
    const container = attach && actionRowFrom(attach, input);
    const before = container && directChildContaining(container, attach!);
    if (container && before) return { container, before };
    return slotLeftOf(input, FALLBACK_LANDMARKS);
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
