// Minimal error/info toast — the extension must never fail silently.

export type ToastKind = 'error' | 'warning' | 'info';

const COLORS: Record<ToastKind, string> = {
  error: '#b3261e',
  warning: '#8a6d00',
  info: '#3a3a3c',
};

const TOAST_ID = 'prompt-polish-toast';
const DISMISS_MS = 5000;

export function showToast(message: string, kind: ToastKind = 'error'): void {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'alert');
  toast.textContent = `Prompt Polish: ${message}`;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    maxWidth: '70vw',
    padding: '10px 16px',
    borderRadius: '8px',
    font: '13px/1.4 system-ui, sans-serif',
    color: '#fff',
    background: COLORS[kind],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
  } satisfies Partial<CSSStyleDeclaration>);

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), DISMISS_MS);
}
