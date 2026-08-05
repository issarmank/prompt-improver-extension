# Adapter research notes

Log per-site selector and DOM research here (input element selectors, framework
quirks, how each site reacts to programmatic text changes).

## chatgpt.com

_Researched 2026-08-05 (from documented DOM structure; re-verify against the
live site when loading the extension — OpenAI ships composer changes often)._

### Prompt input element

- The composer is a **ProseMirror contenteditable**, not a textarea:
  `div#prompt-textarea[contenteditable="true"]`, class list includes
  `ProseMirror`. Selector: `#prompt-textarea` (stable across redesigns —
  OpenAI kept the id when they migrated from the old `<textarea>`).
- Older builds / A-B variants used `<textarea id="prompt-textarea">`. The
  adapter handles both shapes behind the same selector.
- Content is one `<p>` per line. An empty composer holds a single `<p>` with
  a `data-placeholder` attribute (and a trailing `<br>`), so
  `textContent` of an "empty" input is `''` but the element still has child
  nodes — don't test emptiness by `childNodes.length`.
- The composer sits inside a `<form>`; the send button is
  `button[data-testid="send-button"]` (also seen as
  `composer-send-button`). **We never touch it** — it enables itself when
  React state contains text.

### Making React/ProseMirror notice a programmatic change

- Contenteditable path: plain `el.textContent = x` does NOT update
  ProseMirror's internal document — the visible text changes but React state
  stays stale and the send button remains disabled (or sends old text).
  What works: focus the element, select all content
  (`Selection.selectAllChildren`), then
  `document.execCommand('insertText', false, text)`. execCommand is
  deprecated but still the only synchronous API that produces the
  native `beforeinput`/`input` event sequence ProseMirror listens to.
- Fallback (execCommand missing/returns false): replace children with
  `<p>` lines, then dispatch
  `new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })`.
  React's onInput is a delegated listener at the root, so `bubbles: true`
  is required.
- Textarea path (legacy variant): React overrides the `value` property
  descriptor per element to track changes, so `el.value = x` is invisible
  to it. Use the **native prototype setter**
  (`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, x)`)
  then dispatch a bubbling `input` event.

### Button placement

- Mount the Improve button in a wrapper `position: relative`-independent
  overlay appended to `document.body` and positioned near the composer's
  bounding box, NOT inside the form — ChatGPT's React tree re-renders the
  composer subtree frequently and removes foreign children (and inserting
  inside the form risks affecting submit behavior).
- The composer node itself is replaced on route changes (new chat ↔
  existing chat), so re-resolve `findInputElement()` on every click and
  keep a `MutationObserver` on `document.body` to re-attach.

## claude.ai

_Researched 2026-08-05 (from documented DOM structure; re-verify live —
Anthropic redesigns the composer periodically)._

### Prompt input element

- The composer is a **Tiptap/ProseMirror contenteditable**:
  `div[contenteditable="true"]` with class `ProseMirror`, carrying
  `aria-label="Write your prompt to Claude"`. There is no stable id.
- Selector strategy (in order):
  1. `div[aria-label="Write your prompt to Claude"][contenteditable="true"]`
  2. fallback `div.ProseMirror[contenteditable="true"]` — but note that
     **editing a previous message spawns additional ProseMirror instances**
     mid-conversation, so the aria-label selector is strongly preferred and
     the fallback takes the *last* match (the main composer is rendered
     after/below the message list).
- Content: one `<p>` per line. Empty state: a single
  `<p data-placeholder="…" class="is-empty is-editor-empty"><br></p>` —
  `textContent` is `''`, same read logic as chatgpt.
- Send button: `button[aria-label="Send message"]` — never touched.

### Programmatic text changes

- Same as chatgpt.com's contenteditable path (it's the same editor family):
  direct textContent writes update the DOM but not ProseMirror's document,
  leaving the send button disabled. select-all +
  `document.execCommand('insertText')` works; fallback rebuild `<p>` lines +
  bubbling `InputEvent(inputType: 'insertText')`.
- Shared implementation lives in `sites/contenteditable.ts`.

## gemini.google.com

_(nothing yet)_
