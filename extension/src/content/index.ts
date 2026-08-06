// Content script entry: mounts the "✨ Improve" button next to the prompt
// input and runs the rewrite pipeline (backend via service worker → replace
// the input text). Never touches the site's own send button or listeners.
import { requestRewrite, type RewriteErrorKind } from '../lib/messaging';
import { isSiteEnabled } from '../lib/storage';
import { chatgptAdapter } from './sites/chatgpt';
import { claudeAdapter } from './sites/claude';
import { deepseekAdapter } from './sites/deepseek';
import { geminiAdapter } from './sites/gemini';
import { grokAdapter } from './sites/grok';
import type { SiteAdapter } from './sites/types';
import { createImproveButton } from './ui/improve-button';
import { showToast, type ToastKind } from './ui/toast';

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
  document.body.appendChild(button.container);

  // The composer grows and shrinks with the prompt without any DOM mutation
  // the body observer would see (a textarea paste, a CSS height transition),
  // so watch the resolved input's box directly too.
  const sizeObserver = new ResizeObserver(() => scheduleReposition());
  let observedInput: HTMLElement | null = null;

  // The composer node is replaced on route changes, so re-resolve it on every
  // reposition instead of holding a reference.
  const reposition = () => {
    const input = adapter.findInputElement();
    if (input !== observedInput) {
      sizeObserver.disconnect();
      if (input) sizeObserver.observe(input);
      observedInput = input;
    }
    if (input) button.positionNear(input, adapter.positionButton);
    else button.hide();
  };

  let scheduled = false;
  const scheduleReposition = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      reposition();
    });
  };

  new MutationObserver(scheduleReposition).observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('scroll', scheduleReposition, { passive: true });
  window.addEventListener('resize', scheduleReposition, { passive: true });
  reposition();

  button.onClick(async () => {
    const input = adapter.findInputElement();
    if (!input) {
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
        const target = adapter.findInputElement() ?? input;
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
