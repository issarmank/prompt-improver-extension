// Content script entry: mounts the "✨ Improve" button next to the prompt
// input and runs the rewrite pipeline (backend via service worker → replace
// the input text). Never touches the site's own send button or listeners.
import { requestRewrite, type RewriteErrorKind } from '../lib/messaging';
import { chatgptAdapter } from './sites/chatgpt';
import { claudeAdapter } from './sites/claude';
import type { SiteAdapter } from './sites/types';
import { createImproveButton } from './ui/improve-button';
import { showToast, type ToastKind } from './ui/toast';

// gemini.google.com's adapter is still a stub — it mounts here once implemented.
const ADAPTERS: Record<string, SiteAdapter> = {
  'chatgpt.com': chatgptAdapter,
  'claude.ai': claudeAdapter,
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

  // The composer node is replaced on route changes, so re-resolve it on every
  // reposition instead of holding a reference.
  const reposition = () => {
    const input = adapter.findInputElement();
    if (input) button.positionNear(input);
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
if (adapter) mount(adapter);
