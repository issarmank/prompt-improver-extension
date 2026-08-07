# Adapter research notes

Log per-site selector and DOM research here (input element selectors, framework
quirks, how each site reacts to programmatic text changes).

## Button placement across all sites

_Rewritten 2026-08-06. The button used to be a `position: fixed` overlay on
`document.body`, positioned by coordinate math. It is now a real child of each
site's own composer action row — the row that already holds the model picker,
mic and send controls — and it renders there or nowhere._

### Why the overlay was abandoned

- **The contenteditable is not the visible box.** ProseMirror (chatgpt, claude,
  grok) and Quill (gemini) size the editor element to the *full height of its
  content*; an ancestor carries the `max-height` + `overflow-y: auto` that caps
  it. Once the prompt scrolls, the editor's rect is far taller than the composer
  the user sees, and its midpoint slides down with every line added.
- Working around that needed an ancestor-intersecting `visibleBox()`, per-site
  gap/offset tuning, pixel rounding to stop shimmer, six reposition triggers and
  a `ResizeObserver`. All of it is gone: a child of the row is positioned,
  clipped, scrolled, hidden and themed by the site's own layout.

### How the slot is resolved (`content/sites/slot.ts`)

Never by class name — chatgpt, claude, grok and deepseek all hash or churn
theirs on deploy. Three steps, shared by every adapter:

1. `findInComposer(input, selector)` — look for a landmark control, starting at
   the input's parent and widening one ancestor at a time (max 8). Scoping it
   this way stops a header model picker or a modal's file input from matching.
2. `actionRowFrom(landmark, input)` — climb to the **innermost** ancestor that
   is a horizontal flex/grid with more than one element child, stopping before
   any ancestor that contains the editor. Both halves of that test are load
   bearing, and both were found by getting it wrong live:
   - *child count*: these UIs wrap every dropdown in a single-child popover
     anchor, which is not a row.
   - *innermost, and direction*: grok's model pill sits in an `ms-auto` group.
     Docking in the outer row put the button at the far *left* of the composer,
     because `margin-left: auto` on the group swallows all the free space
     between them. Gemini fails the mirror image: the mode picker's immediate
     parent is a flex **column** holding the button and its popover.
3. `directChildContaining(row, landmark)` → the `before` node. `insertBefore`
   with a null `before` appends, which is the natural fallback.

### Where the button lands on each site

Verified live 2026-08-06 against each site's real DOM.

| Site | Landmark | Row it docks in | Sits immediately left of |
|---|---|---|---|
| chatgpt.com | `[data-testid="composer-speech-button"]`, then `aria-label*="dictation"`, then `[data-testid="send-button"]` | `div.ms-auto.flex.items-center.gap-2` | the microphone |
| claude.ai | `[data-testid="model-selector-dropdown"]` | `div.relative.flex.items-center.w-full.gap-2` | the model picker ("Sonnet 5 Medium") |
| gemini.google.com | `bard-mode-switcher`, then `speech-dictation-mic-button` | `div.trailing-actions-wrapper` | the mode picker ("Flash Extended"), or the mic when there is no picker |
| grok.com | `button[aria-label*="Model select"]` | `div.ms-auto.shrink-0.flex.flex-row` | the model/speed pill ("Fast") |
| chat.deepseek.com | the `[role="button"]` beside the hidden `input[type="file"]` | `div.bf38813a` (hashed) | the attach button |

Per-site notes:

- **The send button is not a universal landmark.** claude and gemini have none
  at all — claude's far-right control is `aria-label="Use voice mode"` with
  `type="submit"`, and Enter sends. Anchor off the model picker instead.
- **chatgpt** is a single grid row (leading | editor | trailing) while the
  composer is empty, and only grows a bottom control row once there is text.
  The button is in the trailing group either way, but in the empty state it
  competes for width with the editor — keep the label short.
- **deepseek** labels nothing: every control is a hashed `div[role="button"]`,
  so any control query must include `[role="button"]`. The attach button is
  identified by the hidden `input[type="file"]` next to it in the same group.
  Its `textarea` also has **no id** in the current build, so the adapter's
  `textarea#chat-input` selector is dead and the placeholder fallback carries it.
  - **The file input now sits directly in the action row** (seen live
    2026-08-07: row children are `[attach ds-button, input[type=file], send]`),
    so once our button is docked it is the first `button` in the file input's
    parent. A first-match control query then resolves *our own button* as the
    attach landmark → slot.before becomes our own host → `insertBefore(host,
    host)` every frame. That moves nothing but fires mutation records, so the
    mount loop re-armed itself ~70×/s; a node re-inserted every frame keeps its
    hover tint (mouseleave is lost) and never completes a click (mousedown and
    mouseup straddle a re-insert). Symptom reported as "hover sticks and the
    button won't click". Landmark queries must always skip
    `[data-prompt-polish]`, and `applySlot` treats a slot pointing at the host
    itself as already in place.
- **grok** exposes `aria-label="Model select"` on the pill (text "Fast").
- **gemini's mode picker is optional.** The trailing row is
  `div.trailing-actions-wrapper.with-model-picker`, and some builds/entry points
  drop the `with-model-picker` half entirely — reported live from a
  `?is_sa=1&campaign_id=skws…` landing, where every picker landmark missed and
  the button was hidden. The mic group beside it is `.persistent-mic`, so
  `speech-dictation-mic-button` (then `.input-buttons-wrapper-bottom`) is the
  landmark that survives both layouts; the button lands between picker and mic
  when both are there. Two selectors that look right and are not:
  - `.trailing-actions-wrapper` — its parent is `div.text-input-field`, which
    *contains the editor*, so `actionRowFrom()` breaks on the first step and
    returns null.
  - `button[aria-label*="Dictate" i]` — resolves to the inner
    `div.gem-mic-button-wrapper`, docking the button inside the mic's own
    wrapper rather than in the row.

### Styling

`color: inherit` is **not** enough — on deepseek the row's inherited colour is
`rgb(128, 0, 128)`, a literal purple no control renders in, while the
neighbouring toggle is `rgb(249, 250, 251)`. At mount time the button copies the
computed `color` and `fontFamily` off a real control in the group it is docking
next to (`styleSourceFor` in `content/ui/mount.ts`). Border and hover fill are
`color-mix(in srgb, currentColor …)`, so both follow the adopted colour and both
themes work with no per-site CSS. No shadow DOM — it would cut off exactly the
inheritance this relies on.

The host element sets `align-self: center` on itself rather than trusting the
row. Grok's trailing group is bottom-aligned against its tall voice-mode
circle, so with `align-self` unset the pill rendered ~12px lower than the "Fast"
picker and the mic beside it. Centring our own node covers `items-end`,
`items-start` and `items-baseline` rows alike, and is a no-op on the rows that
already centre (chatgpt, claude, gemini, deepseek).

### Staying mounted

React tolerates the foreign child better than expected: on claude.ai an
injected node survived a full composer re-render (typing a long prompt), and
React inserted a *new* sibling around it without disturbing it — reconciliation
keys off node references, not child indices. The re-insertion loop is still
needed for route changes that replace the composer wholesale.

`ensureMounted()` in `content/index.ts` is therefore written to be idempotent
and callable at any frequency: it re-resolves the slot from scratch and only
touches the DOM when the node is not already in place. It is driven by the body
`MutationObserver`, `popstate`/`hashchange`, and a 1s interval as a safety net.
`scroll`, `resize`, `focusin` and the `ResizeObserver` were all deleted — the
row moves the button because it *is* the row.

## When the button must NOT show (all sites)

_Added 2026-08-06 after the button was seen floating over claude.ai's settings
screen while a chat was open behind it. Docking the button in the composer
solved most of this by construction: a button inside a hidden, inerted, clipped
or unmounted composer is hidden with it._

What survives:

1. `ui/visibility.ts` → `isInputInteractive(input)`: element still connected, no
   `[inert]`/`[aria-hidden="true"]` ancestor (Radix — chatgpt and claude — marks
   the page behind an open modal this way, which is the most reliable "behind an
   overlay" signal available), computed `display`/`visibility` showing, and a
   non-zero rect. The old `[aria-modal]`/`dialog[open]` scan was **dropped**: a
   modal that leaves the page behind it interactive no longer strands the
   button, since the button is covered exactly as the composer is.
2. `SiteAdapter.isSupportedPage?()` — optional per-site route gate. Only claude
   needs one today: its fallback selector `div.ProseMirror[contenteditable]` is
   deliberately broad and also matches settings' own rich-text editors.
3. `findButtonSlot()` returning null. A settings editor has no composer action
   row around it, so nothing is injected — the gate is structural, not a list of
   URLs. When an input is found but no row resolves, the content script logs one
   `console.warn` so a site redesign is diagnosable from a user's console.

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

_Superseded 2026-08-06 — see "Button placement across all sites" above. The
earlier note here claimed React would remove a foreign child of the composer;
tested live, it does not (it keys off node references), so the button now docks
in the trailing control group next to the microphone._

- The composer **is** a `<form>` on this site, so the injected `<button>` must
  carry `type="button"` — a default-type button inside it submits the prompt.
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
