// Site adapter for claude.ai. See NOTES.md ("claude.ai") for the DOM research.
import { readParagraphText, setContentEditableText } from './contenteditable';
import { slotLeftOf } from './slot';
import type { ButtonSlot, SiteAdapter } from './types';

const ARIA_SELECTOR =
  'div[aria-label="Write your prompt to Claude"][contenteditable="true"]';
const FALLBACK_SELECTOR = 'div.ProseMirror[contenteditable="true"]';

// Sections of claude.ai that are not a chat. They matter because settings
// hosts rich-text fields of its own (personal preferences, project
// instructions in the admin views) that FALLBACK_SELECTOR would match.
const NON_CHAT_PATH = /^\/(settings|admin|login|logout|onboarding|pricing|referrals|upgrade)(\/|$)/;

// The button sits to the left of the model picker, in the composer's bottom row
// (+ tools … [Improve] Sonnet ⌄  🎤  ⏵). Claude has no send button — Enter
// sends — so the model dropdown is the only always-present landmark here.
const LANDMARKS = [
  '[data-testid="model-selector-dropdown"]',
  'button[aria-label^="Model:" i]',
  'button[data-testid*="model" i]',
];

export const claudeAdapter: SiteAdapter = {
  siteId: 'claude',

  isSupportedPage(): boolean {
    return !NON_CHAT_PATH.test(location.pathname);
  },

  findInputElement(): HTMLElement | null {
    const byLabel = document.querySelector<HTMLElement>(ARIA_SELECTOR);
    if (byLabel) return byLabel;
    // Editing a previous message spawns extra ProseMirror instances above the
    // main composer, which renders last — take the last match.
    const all = document.querySelectorAll<HTMLElement>(FALLBACK_SELECTOR);
    return all.length > 0 ? all[all.length - 1]! : null;
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
