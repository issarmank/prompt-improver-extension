// @vitest-environment jsdom
// Site-adapter tests: the fragile part is making React/ProseMirror notice a
// programmatic text change, so these assert on the dispatched event sequence.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatgptAdapter } from '../src/content/sites/chatgpt';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('chatgpt adapter — findInputElement', () => {
  it('finds the ProseMirror composer by id', () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true" class="ProseMirror"><p></p></div>';
    const el = chatgptAdapter.findInputElement();
    expect(el).not.toBeNull();
    expect(el!.id).toBe('prompt-textarea');
  });

  it('returns null when the composer is absent', () => {
    expect(chatgptAdapter.findInputElement()).toBeNull();
  });
});

describe('chatgpt adapter — getText', () => {
  it('joins one paragraph per line for the contenteditable composer', () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true"><p>first line</p><p>second line</p></div>';
    const el = chatgptAdapter.findInputElement()!;
    expect(chatgptAdapter.getText(el)).toBe('first line\nsecond line');
  });

  it('reads an empty composer (placeholder <p>) as empty text', () => {
    document.body.innerHTML =
      '<div id="prompt-textarea" contenteditable="true"><p data-placeholder="Ask anything"></p></div>';
    const el = chatgptAdapter.findInputElement()!;
    expect(chatgptAdapter.getText(el)).toBe('');
  });

  it('reads a legacy textarea via .value', () => {
    document.body.innerHTML = '<textarea id="prompt-textarea">draft</textarea>';
    const el = chatgptAdapter.findInputElement()!;
    expect(chatgptAdapter.getText(el)).toBe('draft');
  });
});

describe('chatgpt adapter — setText on the contenteditable composer', () => {
  function mountComposer(): { el: HTMLElement; root: HTMLElement } {
    document.body.innerHTML =
      '<div id="react-root"><div id="prompt-textarea" contenteditable="true"><p>old text</p></div></div>';
    return {
      el: document.getElementById('prompt-textarea')!,
      root: document.getElementById('react-root')!,
    };
  }

  it('replaces the text and dispatches a bubbling input event React can delegate', () => {
    const { el, root } = mountComposer();
    // React attaches delegated listeners at the root, not on the composer.
    const onInput = vi.fn();
    root.addEventListener('input', onInput);

    chatgptAdapter.setText(el, 'improved prompt');

    expect(chatgptAdapter.getText(el)).toBe('improved prompt');
    expect(onInput).toHaveBeenCalledOnce();
    const event = onInput.mock.calls[0]![0] as InputEvent;
    expect(event.bubbles).toBe(true);
    expect(event.inputType).toBe('insertText');
    expect(event.target).toBe(el);
  });

  it('writes multi-line text as one <p> per line, matching ProseMirror structure', () => {
    const { el } = mountComposer();
    chatgptAdapter.setText(el, 'line one\nline two');
    const paragraphs = el.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]!.textContent).toBe('line one');
    expect(paragraphs[1]!.textContent).toBe('line two');
  });

  it('prefers execCommand("insertText") when the browser supports it', () => {
    const { el } = mountComposer();
    const execCommand = vi.fn(() => true);
    (document as Document & { execCommand: typeof execCommand }).execCommand =
      execCommand;
    try {
      chatgptAdapter.setText(el, 'via execCommand');
      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'via execCommand');
      // execCommand handled insertion natively — no manual DOM rewrite.
      expect(el.querySelector('p')!.textContent).toBe('old text');
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });
});

describe('chatgpt adapter — setText on the legacy textarea', () => {
  it('bypasses a React-style value override and fires bubbling input + change', () => {
    document.body.innerHTML =
      '<div id="react-root"><textarea id="prompt-textarea"></textarea></div>';
    const el = document.getElementById('prompt-textarea') as HTMLTextAreaElement;
    const root = document.getElementById('react-root')!;

    // Simulate React's per-element value tracker: an own-property override
    // that would swallow plain `el.value = x` assignments.
    const trackerSet = vi.fn();
    const nativeGet = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.get!;
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: () => nativeGet.call(el) as string,
      set: trackerSet,
    });

    const seen: string[] = [];
    root.addEventListener('input', (e) =>
      seen.push((e.target as HTMLTextAreaElement).value),
    );
    const onChange = vi.fn();
    root.addEventListener('change', onChange);

    chatgptAdapter.setText(el, 'improved prompt');

    // The override was never used — the native prototype setter was.
    expect(trackerSet).not.toHaveBeenCalled();
    // A delegated listener reading target.value during the event sees the new text.
    expect(seen).toEqual(['improved prompt']);
    expect(onChange).toHaveBeenCalledOnce();
  });
});
