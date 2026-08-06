// The inline "✨ Improve" button. It is inserted as a real child of the site's
// own composer action row, so it inherits that row's layout — no coordinate
// math, no overlay, and it can never strand itself over an unrelated screen.
// No shadow DOM: the whole point is to inherit the row's box and typography.

export type ImproveButton = {
  /** The host element to insert into the site's action row. */
  container: HTMLElement;
  setLoading(loading: boolean): void;
  onClick(handler: () => void): void;
  /**
   * Copy the row's own text colour and font off a neighbouring control, so the
   * button reads as native in either theme. `color: inherit` is not enough —
   * on deepseek the row's inherited colour is a literal purple that no control
   * actually renders in.
   */
  adoptStyleFrom(sibling: Element | null): void;
};

const IDLE_LABEL = '✨ Improve';
const FULL_LABEL = 'Improve my prompt';
const LOADING_LABEL = '… Improving';

/** Border and hover fill are derived from the adopted colour, so both themes work. */
const BORDER_TINT = 'color-mix(in srgb, currentColor 30%, transparent)';
const HOVER_TINT = 'color-mix(in srgb, currentColor 10%, transparent)';

export function createImproveButton(): ImproveButton {
  const container = document.createElement('div');
  container.id = 'prompt-polish-improve';
  container.setAttribute('data-prompt-polish', '');
  Object.assign(container.style, {
    display: 'inline-flex',
    alignItems: 'center',
    flex: 'none',
    margin: '0 4px',
  } satisfies Partial<CSSStyleDeclaration>);

  const button = document.createElement('button');
  // The composer is a <form> on chatgpt; a default-type button would submit it.
  button.type = 'button';
  button.textContent = IDLE_LABEL;
  button.title = FULL_LABEL;
  button.setAttribute('aria-label', FULL_LABEL);
  Object.assign(button.style, {
    font: 'inherit',
    fontSize: '12px',
    lineHeight: '1.4',
    fontWeight: '500',
    padding: '4px 10px',
    borderRadius: '999px',
    border: `1px solid ${BORDER_TINT}`,
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flex: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  container.appendChild(button);

  let loading = false;

  // Hover state in JS rather than a stylesheet: injecting global CSS into five
  // different sites is a bigger surface than two listeners on our own node.
  button.addEventListener('mouseenter', () => {
    if (!loading) button.style.background = HOVER_TINT;
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = 'transparent';
  });
  // Clicking must not blur the editor — the caret (and any selection the site
  // tracks) has to survive the rewrite.
  button.addEventListener('mousedown', (e) => e.preventDefault());

  return {
    container,
    setLoading(next: boolean) {
      loading = next;
      button.textContent = next ? LOADING_LABEL : IDLE_LABEL;
      button.style.opacity = next ? '0.6' : '1';
      button.style.cursor = next ? 'wait' : 'pointer';
      button.disabled = next;
    },
    onClick(handler: () => void) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!loading) handler();
      });
    },
    adoptStyleFrom(sibling: Element | null) {
      if (!(sibling instanceof HTMLElement)) return;
      const style = getComputedStyle(sibling);
      if (style.color) button.style.color = style.color;
      if (style.fontFamily) button.style.fontFamily = style.fontFamily;
    },
  };
}
