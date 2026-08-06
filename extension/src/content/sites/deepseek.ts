// Site adapter for chat.deepseek.com. See NOTES.md ("chat.deepseek.com").
import { readParagraphText, setContentEditableText } from './contenteditable';
import { setTextareaText } from './textarea';
import type { SiteAdapter } from './types';
import { leftOfInput } from '../ui/positioning';

// DeepSeek's hashed class names churn on every deploy, so match on the id
// (older builds), placeholder (current builds), then the semantic wrapper
// class. The placeholder is locale-dependent, hence the other two.
const SELECTORS = [
  'textarea#chat-input',
  'textarea[placeholder="Message DeepSeek"]',
  '[class*="chat-input"] textarea',
];

export const deepseekAdapter: SiteAdapter = {
  siteId: 'deepseek',
  positionButton: leftOfInput(60, 0),

  findInputElement(): HTMLElement | null {
    for (const selector of SELECTORS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    }
    return null;
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
