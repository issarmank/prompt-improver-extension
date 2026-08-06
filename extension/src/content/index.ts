// Content script entry: docks the "✨ Improve" button in the site's own
// composer action row and runs the rewrite pipeline (backend via service
// worker → replace the input text). Never touches the site's own send button
// or listeners — it inserts one node and owns only that node.
import { requestRewrite, type RewriteErrorKind } from '../lib/messaging';
import { isSiteEnabled } from '../lib/storage';
import { chatgptAdapter } from './sites/chatgpt';
import { claudeAdapter } from './sites/claude';
import { deepseekAdapter } from './sites/deepseek';
import { geminiAdapter } from './sites/gemini';
import { grokAdapter } from './sites/grok';
import type { SiteAdapter } from './sites/types';
import { createImproveButton } from './ui/improve-button';
import { applySlot, styleSourceFor } from './ui/mount';
import { showToast, type ToastKind } from './ui/toast';
import { isInputInteractive } from './ui/visibility';

const ADAPTERS: Record<string, SiteAdapter> = {
  'chatgpt.com': chatgptAdapter,
  'claude.ai': claudeAdapter,
  'gemini.google.com': geminiAdapter,
  'grok.com': grokAdapter,
  'chat.deepseek.com': deepseekAdapter,
};

function toastKindFor(kind: RewriteErrorKind): ToastKind {
  switch (kind) {
    case 'rate_limited':
    case 'llm_rate_limited':
      return 'warning';
    case 'invalid_request':
      return 'info';
    default:
      return 'error';
  }
}

function mount(adapter: SiteAdapter): void {
  const button = createImproveButton();
  const host = button.container;

  /**
   * The composer the button should attach to, or null when this page has none
   * the user can type into. These sites keep the chat mounted while a settings
   * modal is open and route between sections without a page load, so a match
   * from `findInputElement()` is only good while it is on-screen and in front
   * (see ui/visibility.ts) and while we're actually on a chat route.
   */
  const activeInput = (): HTMLElement | null => {
    if (adapter.isSupportedPage && !adapter.isSupportedPage()) return null;
    const input = adapter.findInputElement();
    return input && isInputInteractive(input) ? input : null;
  };

  // Warn once rather than every tick: a site that redesigns its action row
  // should be diagnosable from a user's console without flooding it.
  let warnedNoSlot = false;

  /**
   * Park the button in the action row, or take it out of the page. The site
   * replaces the composer on route changes and re-renders it on every
   * keystroke, so this re-resolves from scratch and is safe to call at any
   * frequency — it only touches the DOM when the node is not already in place.
   */
  const ensureMounted = () => {
    const input = activeInput();
    const slot = input ? adapter.findButtonSlot(input) : null;
    if (!slot) {
      // No fallback float: the button renders in the action row or nowhere.
      host.remove();
      if (input && !warnedNoSlot) {
        warnedNoSlot = true;
        console.warn(
          `[Prompt Polish] Found the ${adapter.siteId} composer but not its action row — ` +
            'the site\'s layout has probably changed. The Improve button is hidden.',
        );
      }
      return;
    }
    warnedNoSlot = false;
    // Re-theming is only worth doing when we actually (re)entered a row.
    if (applySlot(host, slot)) button.adoptStyleFrom(styleSourceFor(slot));
  };

  let scheduled = false;
  const scheduleReposition = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureMounted();
    });
  };

  new MutationObserver(scheduleReposition).observe(document.body, {
    childList: true,
    subtree: true,
    // Opening a modal can hide the composer without touching the tree it lives
    // in — Radix (chatgpt, claude) just flips these attributes on the page
    // behind the overlay. Filtered so ordinary class/style churn stays cheap.
    attributes: true,
    attributeFilter: ['aria-hidden', 'inert', 'open'],
  });
  // Back/forward between sections; SPA pushes are caught by the tree they render.
  window.addEventListener('popstate', scheduleReposition);
  window.addEventListener('hashchange', scheduleReposition);
  // Safety net for a re-render the filtered observer misses: one rAF-throttled
  // recheck a second, so a dropped button always comes back. Scroll, resize and
  // focus no longer matter — the row moves the button because it *is* the row.
  setInterval(scheduleReposition, 1000);
  ensureMounted();

  button.onClick(async () => {
    const input = activeInput();
    if (!input) {
      // The page changed under a stale button; drop it until a composer is back.
      host.remove();
      showToast('Could not find the prompt input on this page.');
      return;
    }
    const text = adapter.getText(input).trim();
    if (!text) {
      showToast('Write a prompt first, then click Improve.', 'info');
      return;
    }

    button.setLoading(true);
    try {
      const res = await requestRewrite(text, adapter.siteId);
      if (res.ok) {
        const target = activeInput() ?? input;
        adapter.setText(target, res.improved);
      } else {
        // Message text is already distinct per error kind (service worker).
        showToast(res.message, toastKindFor(res.kind));
      }
    } catch {
      showToast('Could not reach the extension service worker — try reloading the page.');
    } finally {
      button.setLoading(false);
    }
  });
}

const adapter = ADAPTERS[location.hostname];
if (adapter) {
  // Respect the per-site toggle from the options page: when the site is
  // disabled, inject nothing at all.
  void isSiteEnabled(adapter.siteId).then((enabled) => {
    if (enabled) mount(adapter);
  });
}
