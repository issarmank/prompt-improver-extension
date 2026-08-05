// Shared helpers for contenteditable rich-text composers (ProseMirror on
// chatgpt.com and claude.ai, Quill on gemini.google.com). All three keep one
// <p> per line and ignore direct textContent writes, so the same read/write
// tricks apply. Site adapters stay isolated: they only call into this module.

/** Read composer text as one line per <p>; empty/placeholder paragraphs read as ''. */
export function readParagraphText(el: HTMLElement): string {
  const paragraphs = el.querySelectorAll('p');
  if (paragraphs.length === 0) return el.textContent ?? '';
  return Array.from(paragraphs)
    .map((p) => p.textContent ?? '')
    .join('\n');
}

/**
 * Rich-text editors ignore direct textContent writes. execCommand('insertText')
 * over a select-all produces the native beforeinput/input sequence they do
 * listen to. If execCommand is unavailable, rebuild the paragraphs and
 * synthesize a bubbling InputEvent for the framework's delegated onInput.
 */
export function setContentEditableText(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument;
  el.focus();

  try {
    doc.defaultView?.getSelection()?.selectAllChildren(el);
  } catch {
    // jsdom's Selection support is partial; the fallback path covers it.
  }

  let inserted = false;
  if (typeof doc.execCommand === 'function') {
    try {
      inserted = doc.execCommand('insertText', false, text) === true;
    } catch {
      inserted = false;
    }
  }
  if (inserted) return;

  el.replaceChildren(
    ...text.split('\n').map((line) => {
      const p = doc.createElement('p');
      p.textContent = line;
      return p;
    }),
  );
  el.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }),
  );
}
