// The floating "✨ Improve" button. Lives in an overlay on document.body so
// the site's React tree can't remove it when it re-renders the composer.
import type { PositionButton } from '../sites/types';
import { leftOfInput } from './positioning';

export type ImproveButton = {
  container: HTMLElement;
  setLoading(loading: boolean): void;
  onClick(handler: () => void): void;
  /** Position the button using the given strategy, or the shared default if omitted. */
  positionNear(input: HTMLElement, positionButton?: PositionButton): void;
  hide(): void;
};

const IDLE_LABEL = '✨ Improve My Prompt';
const LOADING_LABEL = '… Improving';

const DEFAULT_POSITION: PositionButton = leftOfInput(60, 8);

export function createImproveButton(): ImproveButton {
  const container = document.createElement('div');
  container.id = 'prompt-polish-improve';
  Object.assign(container.style, {
    position: 'fixed',
    zIndex: '2147483646',
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = IDLE_LABEL;
  Object.assign(button.style, {
    font: '12px/1.4 system-ui, sans-serif',
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid rgba(120, 120, 128, 0.35)',
    background: 'rgba(30, 30, 30, 0.85)',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
  } satisfies Partial<CSSStyleDeclaration>);
  container.appendChild(button);

  let loading = false;

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
    positionNear(input: HTMLElement, positionButton: PositionButton = DEFAULT_POSITION) {
      container.style.display = 'block';
      const { width, height } = container.getBoundingClientRect();
      const { top, left } = positionButton(input, { width, height });
      container.style.top = `${top}px`;
      container.style.left = `${left}px`;
    },
    hide() {
      container.style.display = 'none';
    },
  };
}
