// @vitest-environment jsdom
// Site-adapter tests: the fragile part is making React/ProseMirror notice a
// programmatic text change, so these assert on the dispatched event sequence.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatgptAdapter } from '../src/content/sites/chatgpt';
import { claudeAdapter } from '../src/content/sites/claude';
import { deepseekAdapter } from '../src/content/sites/deepseek';
import { geminiAdapter } from '../src/content/sites/gemini';
import { grokAdapter } from '../src/content/sites/grok';

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

const CLAUDE_COMPOSER =
  '<div aria-label="Write your prompt to Claude" contenteditable="true" class="ProseMirror">';

describe('claude adapter — findInputElement', () => {
  it('finds the composer by aria-label', () => {
    document.body.innerHTML = `${CLAUDE_COMPOSER}<p></p></div>`;
    const el = claudeAdapter.findInputElement();
    expect(el).not.toBeNull();
    expect(el!.getAttribute('aria-label')).toBe('Write your prompt to Claude');
  });

  it('falls back to the LAST ProseMirror instance (main composer renders below edit boxes)', () => {
    document.body.innerHTML =
      '<div contenteditable="true" class="ProseMirror" id="edit-box"><p>old message</p></div>' +
      '<div contenteditable="true" class="ProseMirror" id="composer"><p></p></div>';
    const el = claudeAdapter.findInputElement();
    expect(el!.id).toBe('composer');
  });

  it('returns null when no composer exists', () => {
    expect(claudeAdapter.findInputElement()).toBeNull();
  });
});

describe('claude adapter — getText/setText', () => {
  it('reads the Tiptap empty-placeholder state as empty text', () => {
    document.body.innerHTML = `${CLAUDE_COMPOSER}<p data-placeholder="How can Claude help?" class="is-empty is-editor-empty"><br></p></div>`;
    const el = claudeAdapter.findInputElement()!;
    expect(claudeAdapter.getText(el)).toBe('');
  });

  it('joins one paragraph per line', () => {
    document.body.innerHTML = `${CLAUDE_COMPOSER}<p>alpha</p><p>beta</p></div>`;
    const el = claudeAdapter.findInputElement()!;
    expect(claudeAdapter.getText(el)).toBe('alpha\nbeta');
  });

  it('setText replaces the text and dispatches a bubbling insertText InputEvent', () => {
    document.body.innerHTML = `<div id="react-root">${CLAUDE_COMPOSER}<p>old</p></div></div>`;
    const el = claudeAdapter.findInputElement()!;
    const onInput = vi.fn();
    document.getElementById('react-root')!.addEventListener('input', onInput);

    claudeAdapter.setText(el, 'better\nprompt');

    expect(claudeAdapter.getText(el)).toBe('better\nprompt');
    expect(el.querySelectorAll('p')).toHaveLength(2);
    expect(onInput).toHaveBeenCalledOnce();
    const event = onInput.mock.calls[0]![0] as InputEvent;
    expect(event.bubbles).toBe(true);
    expect(event.inputType).toBe('insertText');
    expect(event.target).toBe(el);
  });

  it('setText prefers execCommand("insertText") when available', () => {
    document.body.innerHTML = `${CLAUDE_COMPOSER}<p>old</p></div>`;
    const el = claudeAdapter.findInputElement()!;
    const execCommand = vi.fn(() => true);
    (document as Document & { execCommand: typeof execCommand }).execCommand =
      execCommand;
    try {
      claudeAdapter.setText(el, 'via execCommand');
      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'via execCommand');
      expect(el.querySelector('p')!.textContent).toBe('old');
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });
});

describe('gemini adapter — findInputElement', () => {
  it('finds the Quill editor inside rich-textarea', () => {
    document.body.innerHTML =
      '<rich-textarea><div class="ql-editor textarea" contenteditable="true" role="textbox" aria-label="Enter a prompt here"><p><br></p></div></rich-textarea>';
    const el = geminiAdapter.findInputElement();
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ql-editor')).toBe(true);
  });

  it('falls back to a bare ql-editor when rich-textarea is absent', () => {
    document.body.innerHTML =
      '<div class="ql-editor" contenteditable="true" id="bare"><p></p></div>';
    expect(geminiAdapter.findInputElement()!.id).toBe('bare');
  });

  it('returns null when no editor exists', () => {
    expect(geminiAdapter.findInputElement()).toBeNull();
  });
});

describe('gemini adapter — getText/setText', () => {
  function mountEditor(inner: string): HTMLElement {
    document.body.innerHTML = `<div id="app-root"><rich-textarea><div class="ql-editor ql-blank" contenteditable="true">${inner}</div></rich-textarea></div>`;
    return geminiAdapter.findInputElement()!;
  }

  it('reads the Quill empty state (<p><br></p>) as empty text', () => {
    const el = mountEditor('<p><br></p>');
    expect(geminiAdapter.getText(el)).toBe('');
  });

  it('joins one paragraph per line', () => {
    const el = mountEditor('<p>first</p><p>second</p>');
    expect(geminiAdapter.getText(el)).toBe('first\nsecond');
  });

  it('setText replaces the text and dispatches a bubbling insertText InputEvent', () => {
    const el = mountEditor('<p>old</p>');
    const onInput = vi.fn();
    document.getElementById('app-root')!.addEventListener('input', onInput);

    geminiAdapter.setText(el, 'polished\nprompt');

    expect(geminiAdapter.getText(el)).toBe('polished\nprompt');
    expect(el.querySelectorAll('p')).toHaveLength(2);
    expect(onInput).toHaveBeenCalledOnce();
    const event = onInput.mock.calls[0]![0] as InputEvent;
    expect(event.bubbles).toBe(true);
    expect(event.inputType).toBe('insertText');
    expect(event.target).toBe(el);
  });

  it('setText prefers execCommand("insertText") when available', () => {
    const el = mountEditor('<p>old</p>');
    const execCommand = vi.fn(() => true);
    (document as Document & { execCommand: typeof execCommand }).execCommand =
      execCommand;
    try {
      geminiAdapter.setText(el, 'via execCommand');
      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'via execCommand');
      expect(el.querySelector('p')!.textContent).toBe('old');
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });
});

const GROK_COMPOSER =
  '<div class="tiptap ProseMirror" contenteditable="true" translate="no">';

describe('grok adapter — findInputElement', () => {
  it('finds the Tiptap/ProseMirror composer', () => {
    document.body.innerHTML = `${GROK_COMPOSER}<p></p></div>`;
    const el = grokAdapter.findInputElement();
    expect(el).not.toBeNull();
    expect(el!.classList.contains('tiptap')).toBe(true);
  });

  it('prefers the Tiptap composer over a legacy textarea when both exist', () => {
    document.body.innerHTML =
      '<textarea aria-label="Ask Grok anything"></textarea>' +
      `${GROK_COMPOSER}<p></p></div>`;
    expect(grokAdapter.findInputElement()!.classList.contains('tiptap')).toBe(true);
  });

  it('falls back to the legacy textarea variant', () => {
    document.body.innerHTML =
      '<textarea aria-label="Ask Grok anything">draft</textarea>';
    const el = grokAdapter.findInputElement();
    expect(el).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('returns null when no composer exists', () => {
    expect(grokAdapter.findInputElement()).toBeNull();
  });
});

describe('grok adapter — getText/setText on the Tiptap composer', () => {
  it('reads the empty-placeholder state as empty text', () => {
    document.body.innerHTML = `${GROK_COMPOSER}<p data-placeholder="What do you want to know?"><br></p></div>`;
    const el = grokAdapter.findInputElement()!;
    expect(grokAdapter.getText(el)).toBe('');
  });

  it('joins one paragraph per line', () => {
    document.body.innerHTML = `${GROK_COMPOSER}<p>alpha</p><p>beta</p></div>`;
    const el = grokAdapter.findInputElement()!;
    expect(grokAdapter.getText(el)).toBe('alpha\nbeta');
  });

  it('setText replaces the text and dispatches a bubbling insertText InputEvent', () => {
    document.body.innerHTML = `<div id="react-root">${GROK_COMPOSER}<p>old</p></div></div>`;
    const el = grokAdapter.findInputElement()!;
    const onInput = vi.fn();
    document.getElementById('react-root')!.addEventListener('input', onInput);

    grokAdapter.setText(el, 'sharper\nprompt');

    expect(grokAdapter.getText(el)).toBe('sharper\nprompt');
    expect(el.querySelectorAll('p')).toHaveLength(2);
    expect(onInput).toHaveBeenCalledOnce();
    const event = onInput.mock.calls[0]![0] as InputEvent;
    expect(event.bubbles).toBe(true);
    expect(event.inputType).toBe('insertText');
    expect(event.target).toBe(el);
  });

  it('setText prefers execCommand("insertText") when available', () => {
    document.body.innerHTML = `${GROK_COMPOSER}<p>old</p></div>`;
    const el = grokAdapter.findInputElement()!;
    const execCommand = vi.fn(() => true);
    (document as Document & { execCommand: typeof execCommand }).execCommand =
      execCommand;
    try {
      grokAdapter.setText(el, 'via execCommand');
      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'via execCommand');
      expect(el.querySelector('p')!.textContent).toBe('old');
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });
});

describe('grok adapter — setText on the legacy textarea', () => {
  it('bypasses a React-style value override and fires bubbling input + change', () => {
    document.body.innerHTML =
      '<div id="react-root"><textarea aria-label="Ask Grok anything"></textarea></div>';
    const el = grokAdapter.findInputElement() as HTMLTextAreaElement;
    const root = document.getElementById('react-root')!;

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

    grokAdapter.setText(el, 'improved prompt');

    expect(trackerSet).not.toHaveBeenCalled();
    expect(seen).toEqual(['improved prompt']);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('deepseek adapter — findInputElement', () => {
  it('finds the textarea by id (older builds)', () => {
    document.body.innerHTML = '<textarea id="chat-input"></textarea>';
    const el = deepseekAdapter.findInputElement();
    expect(el).not.toBeNull();
    expect(el!.id).toBe('chat-input');
  });

  it('falls back to the placeholder selector (current builds)', () => {
    document.body.innerHTML =
      '<textarea placeholder="Message DeepSeek" class="_27c9245 ds-scroll-area"></textarea>';
    const el = deepseekAdapter.findInputElement();
    expect(el).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('falls back to a textarea inside a chat-input wrapper (localized placeholder)', () => {
    document.body.innerHTML =
      '<div class="chat-input-panel"><textarea placeholder="给 DeepSeek 发送消息"></textarea></div>';
    const el = deepseekAdapter.findInputElement();
    expect(el).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('returns null when no composer exists', () => {
    expect(deepseekAdapter.findInputElement()).toBeNull();
  });
});

describe('deepseek adapter — getText/setText', () => {
  it('reads the textarea via .value', () => {
    document.body.innerHTML = '<textarea id="chat-input">draft</textarea>';
    const el = deepseekAdapter.findInputElement()!;
    expect(deepseekAdapter.getText(el)).toBe('draft');
  });

  it('setText bypasses a React-style value override and fires bubbling input + change', () => {
    document.body.innerHTML =
      '<div id="react-root"><textarea id="chat-input"></textarea></div>';
    const el = deepseekAdapter.findInputElement() as HTMLTextAreaElement;
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

    deepseekAdapter.setText(el, 'improved prompt');

    // The override was never used — the native prototype setter was.
    expect(trackerSet).not.toHaveBeenCalled();
    // A delegated listener reading target.value during the event sees the new text.
    expect(seen).toEqual(['improved prompt']);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('setText preserves newlines in the textarea value', () => {
    document.body.innerHTML = '<textarea id="chat-input"></textarea>';
    const el = deepseekAdapter.findInputElement() as HTMLTextAreaElement;
    deepseekAdapter.setText(el, 'line one\nline two');
    expect(el.value).toBe('line one\nline two');
  });
});
