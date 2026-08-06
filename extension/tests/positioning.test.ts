// @vitest-environment jsdom
// Placement tests: the fragile part is that editors size the contenteditable
// to its full content height, so the button must key off the visible box.
import { beforeEach, describe, expect, it } from 'vitest';
import { leftOfInput, visibleBox } from '../src/content/ui/positioning';

const BUTTON = { width: 150, height: 24 };

/** jsdom has no layout, so hand each element the rect the test needs. */
function stubRect(el: HTMLElement, r: { top: number; left: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.top + r.height,
      right: r.left + r.width,
      x: r.left,
      y: r.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** A scrolling composer: an overflow-hidden shell clipping a taller editor. */
function buildComposer(shellHeight: number, contentHeight: number) {
  document.body.innerHTML = '<div id="shell"><div id="editor"></div></div>';
  const shell = document.querySelector<HTMLElement>('#shell')!;
  const editor = document.querySelector<HTMLElement>('#editor')!;
  shell.style.overflowY = 'auto';
  stubRect(shell, { top: 200, left: 400, width: 600, height: shellHeight });
  // The editor keeps its top pinned to the scroll position and runs long.
  stubRect(editor, { top: 200, left: 400, width: 600, height: contentHeight });
  return { shell, editor };
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.innerHeight = 900;
});

describe('visibleBox', () => {
  it('clips the input to its scrolling ancestor', () => {
    const { editor } = buildComposer(300, 2000);
    expect(visibleBox(editor)).toEqual({ top: 200, left: 400, width: 600, height: 300 });
  });

  it('returns the input rect unchanged when nothing clips it', () => {
    document.body.innerHTML = '<div id="editor"></div>';
    const editor = document.querySelector<HTMLElement>('#editor')!;
    stubRect(editor, { top: 200, left: 400, width: 600, height: 120 });
    expect(visibleBox(editor)).toEqual({ top: 200, left: 400, width: 600, height: 120 });
  });
});

describe('leftOfInput', () => {
  it('stays put as the prompt grows past the composer max height', () => {
    const position = leftOfInput(60, 0);

    const short = buildComposer(300, 300);
    const shortPos = position(short.editor, BUTTON);

    const long = buildComposer(300, 4000);
    const longPos = position(long.editor, BUTTON);

    expect(longPos).toEqual(shortPos);
    // Centered on the 200..500 visible box.
    expect(shortPos.top).toBe(350 - BUTTON.height / 2);
    expect(shortPos.left).toBe(400 - BUTTON.width - 60);
  });

  it('applies the vertical offset upward', () => {
    const { editor } = buildComposer(300, 2000);
    expect(leftOfInput(60, 8)(editor, BUTTON).top).toBe(350 - BUTTON.height / 2 - 8);
  });

  it('clamps to the viewport instead of going off-screen', () => {
    document.body.innerHTML = '<div id="editor"></div>';
    const editor = document.querySelector<HTMLElement>('#editor')!;

    stubRect(editor, { top: -400, left: 10, width: 600, height: 100 });
    const offTop = leftOfInput(60, 0)(editor, BUTTON);
    expect(offTop.top).toBe(4);
    expect(offTop.left).toBe(4);

    stubRect(editor, { top: 2000, left: 400, width: 600, height: 100 });
    expect(leftOfInput(60, 0)(editor, BUTTON).top).toBe(900 - BUTTON.height - 4);
  });
});
