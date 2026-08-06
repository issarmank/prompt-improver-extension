// @vitest-environment jsdom
// The gate that keeps the Improve button off non-chat screens. The fragile
// part is that these SPAs keep the composer mounted (and matchable) while a
// settings modal covers it or another section is showing.
import { beforeEach, describe, expect, it } from 'vitest';
import { isInputInteractive } from '../src/content/ui/visibility';

/** jsdom has no layout, so hand each element the rect the test needs. */
function stubRect(el: HTMLElement, r: { width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      top: 700,
      left: 300,
      width: r.width,
      height: r.height,
      bottom: 700 + r.height,
      right: 300 + r.width,
      x: 300,
      y: 700,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** A composer sitting in the page, as it looks on a live chat route. */
function buildComposer(): HTMLElement {
  document.body.innerHTML = '<div id="page"><div id="composer" contenteditable="true"></div></div>';
  const composer = document.querySelector<HTMLElement>('#composer')!;
  stubRect(composer, { width: 600, height: 60 });
  return composer;
}

/** An open settings modal, Radix-style: the page behind it gets aria-hidden. */
function openModal(inertPageBehind: boolean): HTMLElement {
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  stubRect(modal, { width: 800, height: 500 });
  document.body.appendChild(modal);
  if (inertPageBehind) document.querySelector('#page')!.setAttribute('aria-hidden', 'true');
  return modal;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isInputInteractive', () => {
  it('accepts a composer on a live chat page', () => {
    expect(isInputInteractive(buildComposer())).toBe(true);
  });

  it('rejects a composer detached by a route change', () => {
    const composer = buildComposer();
    composer.remove();
    expect(isInputInteractive(composer)).toBe(false);
  });

  it('rejects a composer left mounted with no box', () => {
    const composer = buildComposer();
    stubRect(composer, { width: 0, height: 0 });
    expect(isInputInteractive(composer)).toBe(false);
  });

  it('rejects a composer hidden by CSS', () => {
    const composer = buildComposer();
    composer.style.visibility = 'hidden';
    expect(isInputInteractive(composer)).toBe(false);
  });

  // A modal that leaves the page behind it interactive used to matter, because
  // a floating button would sit on top of the overlay. The button now lives
  // inside the composer, so it is covered exactly as the composer is.
  it('accepts a composer behind a modal that does not inert the page', () => {
    const composer = buildComposer();
    openModal(false);
    expect(isInputInteractive(composer)).toBe(true);
  });

  it('rejects a composer whose page was aria-hidden behind an overlay', () => {
    const composer = buildComposer();
    openModal(true);
    expect(isInputInteractive(composer)).toBe(false);
  });

  it('rejects a composer inside an inert section', () => {
    const composer = buildComposer();
    document.querySelector('#page')!.setAttribute('inert', '');
    expect(isInputInteractive(composer)).toBe(false);
  });

  it('accepts a composer that lives inside the open dialog itself', () => {
    const modal = openModal(false);
    modal.innerHTML = '<div id="composer" contenteditable="true"></div>';
    const composer = modal.querySelector<HTMLElement>('#composer')!;
    stubRect(composer, { width: 600, height: 60 });
    expect(isInputInteractive(composer)).toBe(true);
  });

  it('ignores a modal that is present but closed', () => {
    const composer = buildComposer();
    const modal = openModal(false);
    modal.style.display = 'none';
    expect(isInputInteractive(composer)).toBe(true);
  });
});
