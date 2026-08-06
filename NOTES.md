# Adapter research notes

Log per-site selector and DOM research here (input element selectors, framework
quirks, how each site reacts to programmatic text changes).

## Button placement across all sites

- **The contenteditable is not the visible box.** ProseMirror (chatgpt,
  claude) and Quill (gemini) size the editor element to the *full height of
  its content*; an ancestor carries the `max-height` + `overflow-y: auto`
  that caps it. So once the prompt is long enough to scroll, the editor's
  `getBoundingClientRect()` is far taller than the composer the user sees —
  often running off the bottom of the viewport — and its midpoint slides
  down with every line added. Anchoring the button to that rect makes it
  drift as you type/paste.
- Fix: `ui/positioning.ts` → `visibleBox(input)` walks up to 8 ancestors and
  intersects the input's rect with every one whose computed `overflow-y` is
  not `visible`. That yields the stable visible box, which stops changing
  once the composer hits its max height. `leftOfInput()` centers on it.
- CSS forces both overflow axes to a non-`visible` value when either is set,
  so testing `overflowY` alone is enough to spot a clipping ancestor.
- Repositioning triggers: a `MutationObserver` on `document.body` catches
  contenteditable edits, but **not** a textarea paste or a CSS height
  transition — hence the extra `ResizeObserver` on the resolved input in
  `content/index.ts`. Positions are rounded to whole pixels; without that,
  subpixel rect changes make the button shimmer on every keystroke.

## When the button must NOT show (all sites)

_Added 2026-08-06 after the button was seen floating over claude.ai's settings
screen while a chat was open behind it._

Finding the composer is not enough to show the button — all five sites are
SPAs that leave it in the DOM on screens where it isn't usable:

- **Settings-as-a-modal** (chatgpt, claude, grok, deepseek). The chat stays
  mounted and the selectors keep matching it; only an overlay sits on top, so
  the button rendered above the modal at `z-index: 2147483646`.
- **Settings-as-a-route with rich-text fields of its own** (claude
  `/settings/*`). The claude adapter's fallback selector is
  `div.ProseMirror[contenteditable="true"]` — deliberately broad, so it also
  matches settings' own editors, and the button attaches to those.
- **Composer left mounted but hidden** after a client-side route change.

Two gates in front of `findInputElement()`, both re-evaluated on every
reposition (`activeInput()` in `content/index.ts`):

1. `ui/visibility.ts` → `isInputInteractive(input)`: element still connected,
   no `[inert]`/`[aria-hidden="true"]` ancestor (Radix — chatgpt and claude —
   marks the page behind an open modal this way, which is the most reliable
   "behind an overlay" signal available), computed `display`/`visibility`
   showing, a non-zero `visibleBox`, and no `[aria-modal="true"] , dialog[open]`
   elsewhere in the document. A composer *inside* the open dialog still counts.
2. `SiteAdapter.isSupportedPage?()` — optional per-site route gate. Only claude
   needs one today (its broad fallback selector); the exact selectors on the
   other sites (`#prompt-textarea`, `rich-textarea .ql-editor`, …) never match
   outside a composer, so they rely on gate 1 alone.

Repositioning triggers had to grow to notice these: the body `MutationObserver`
now also watches the `aria-hidden`/`inert`/`open` attributes (a modal can hide
the composer without touching its subtree), plus `popstate`, `hashchange`,
`focusin`, and a 1s interval as a safety net for overlays that show themselves
with a class swap. History `pushState` can't be hooked — the content script
runs in an isolated world — but the tree the new route renders fires the
observer anyway.

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

_Researched 2026-08-05 (from documented DOM structure; re-verify live —
Google ships Gemini UI changes frequently)._

### Prompt input element

- Gemini is an **Angular** app and the composer is a **Quill editor**
  contenteditable: `div.ql-editor[contenteditable="true"]` with
  `role="textbox"` and `aria-label="Enter a prompt here"`, wrapped in a
  custom `<rich-textarea>` element.
- Selector strategy (in order):
  1. `rich-textarea .ql-editor[contenteditable="true"]` (most specific)
  2. fallback `div.ql-editor[contenteditable="true"]`
- Content: one `<p>` per line (Quill convention). Empty state: a single
  `<p><br></p>` and the editor carries class `ql-blank` — `textContent`
  reads `''`, same read logic as the ProseMirror sites.
- Send button: `button[aria-label="Send message"]` (mat-icon button) —
  never touched.

### Programmatic text changes

- Quill differs from ProseMirror in one helpful way: it watches its DOM with
  a MutationObserver and syncs external DOM writes back into its document
  model, so the paragraph-rebuild fallback is genuinely reliable here. The
  bubbling `input` event still matters so Angular's zone/listeners notice
  and enable the send button.
- select-all + `document.execCommand('insertText')` also works (Quill
  handles the native beforeinput/input sequence), so the shared
  `sites/contenteditable.ts` implementation is used unchanged.

## grok.com

_Researched 2026-08-05 from selector lists maintained by third-party
extensions/userscripts that track Grok's DOM (OneClickPrompts
`buttons-clicking-grok.js` + selector defaults, nisc/grok-userscripts);
re-verify live — xAI ships composer changes often._

### Prompt input element

- Grok is a **React/Next.js** app (Tailwind utility classes everywhere, no
  stable ids). The current composer is a **Tiptap/ProseMirror
  contenteditable**: `div.tiptap.ProseMirror[contenteditable="true"]`,
  usually carrying `translate="no"`. It sits inside a `<form>` within a
  `.query-bar` container.
- Older builds used a plain `<textarea aria-label="Ask Grok anything">`
  (classes `w-full text-fg-primary …` — pure Tailwind, not selector-safe).
  Some A/B variants may still serve it, so the adapter keeps the textarea
  as a fallback behind the Tiptap selector.
- Selector strategy (in order):
  1. `div.tiptap.ProseMirror[contenteditable="true"]` (current editor)
  2. fallback `textarea[aria-label="Ask Grok anything"]` (legacy variant)
- Content in the Tiptap editor: one `<p>` per line; empty state is a single
  `<p>` with a placeholder attribute — same read logic as chatgpt/claude
  (Tiptap is a ProseMirror wrapper, identical DOM conventions).
- Send button: `button[type="submit"][aria-label="Submit"]` inside the
  composer form — **never touched**; it enables itself off editor state.

### Programmatic text changes

- Tiptap path: same editor family as chatgpt/claude — direct
  textContent/innerText writes update the DOM but not ProseMirror's
  document (third-party scripts that write `innerText` have to fake an
  extra trailing keystroke to force a resync). select-all +
  `document.execCommand('insertText')` produces the native
  beforeinput/input sequence Tiptap listens to; shared
  `sites/contenteditable.ts` used unchanged.
- Legacy textarea path: React value-tracker problem, same as chatgpt's
  legacy textarea — write via the native prototype setter, then dispatch
  bubbling `input`/`change`. Shared helper extracted to
  `sites/textarea.ts`.

## chat.deepseek.com

_Researched 2026-08-05 from selector lists maintained by third-party
extensions that track DeepSeek's DOM (OneClickPrompts
`heuristics-deepseek.js` + selector defaults, MCP-SuperAssistant);
re-verify live — DeepSeek regenerates its hashed class names on nearly
every deploy._

### Prompt input element

- DeepSeek is a **React** app and the composer is a plain **`<textarea>`**,
  not a contenteditable. Earlier builds gave it `id="chat-input"`; current
  builds drop the id and identify it only by
  `placeholder="Message DeepSeek"` plus hashed CSS classes (`_27c9245`,
  `ds-scroll-area`) that **churn on every deploy** — never select by class.
- Selector strategy (in order):
  1. `textarea#chat-input` (older builds, most specific when present)
  2. `textarea[placeholder="Message DeepSeek"]` (current builds)
  3. `[class*="chat-input"] textarea` (wrapper keeps a semantic class even
     when the textarea's own classes are hashed)
- Placeholder text is locale-dependent (Chinese UI shows a different
  string), so the id and wrapper fallbacks matter for non-English users.
- Send button: a `.ds-icon-button` div-styled button near the editor footer
  with `aria-disabled` state — **never touched**; it enables itself when
  React state contains text.

### Programmatic text changes

- Standard React controlled-textarea problem, exactly the chatgpt legacy
  path: React installs a per-element `value` property override to track
  input, so a plain `el.value = x` assignment is swallowed. Write through
  the **native prototype setter** and dispatch a bubbling `input` event
  (plus `change`) so React's delegated onChange re-reads the value and
  enables the send button. Shared implementation: `sites/textarea.ts`.
- No contenteditable variant has been observed, but the adapter routes a
  non-textarea match through `sites/contenteditable.ts` defensively, same
  shape as the chatgpt adapter.
