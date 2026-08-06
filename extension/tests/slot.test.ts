// @vitest-environment jsdom
// Slot resolution: where the button docks inside each site's composer action
// row. The fixtures mirror the real DOM captured in NOTES.md — structure and
// landmark attributes are reproduced faithfully, hashed class names are not
// (they churn on every deploy, which is exactly why nothing anchors to them).
import { beforeEach, describe, expect, it } from 'vitest';
import { chatgptAdapter } from '../src/content/sites/chatgpt';
import { claudeAdapter } from '../src/content/sites/claude';
import { deepseekAdapter } from '../src/content/sites/deepseek';
import { geminiAdapter } from '../src/content/sites/gemini';
import { grokAdapter } from '../src/content/sites/grok';
import { applySlot, styleSourceFor } from '../src/content/ui/mount';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Rows carry an inline display, since jsdom computes no stylesheet layout. */
const ROW = 'display:flex';
const COLUMN = 'display:flex;flex-direction:column';

/** chatgpt: leading | editor | trailing (dictation, send), each in a tooltip wrapper. */
function mountChatgpt(): void {
  document.body.innerHTML = `
    <form>
      <div class="leading"><button aria-label="Add photos and files"></button></div>
      <div id="prompt-textarea" contenteditable="true"><p></p></div>
      <div class="trailing">
        <div id="chatgpt-row" style="${ROW}">
          <button id="dictation" data-testid="composer-speech-button" aria-label="Start dictation"></button>
          <button id="send" data-testid="send-button"></button>
        </div>
      </div>
    </form>`;
}

/** claude: bottom row of + tools … model picker, mic, voice. No send button. */
function mountClaude(): void {
  document.body.innerHTML = `
    <div class="composer">
      <div class="ProseMirror" contenteditable="true" aria-label="Write your prompt to Claude"><p></p></div>
      <div id="claude-row" style="${ROW}">
        <div class="tools"><button aria-label="Open attachments menu"></button></div>
        <div class="grow"></div>
        <div id="claude-model-group"><span><div>
          <button data-testid="model-selector-dropdown" aria-label="Model: Sonnet 5">Sonnet 5</button>
        </div></span></div>
        <div class="record"></div>
        <div class="voice"><button aria-label="Use voice mode"></button></div>
      </div>
    </div>`;
}

/**
 * gemini: editor | leading-actions-wrapper | trailing-actions-wrapper, with the
 * mode picker sitting in a *column* next to its own popover. The picker half is
 * optional live (the wrapper is `.with-model-picker` only sometimes); the mic
 * group is not (`.persistent-mic`).
 */
function mountGemini(): void {
  document.body.innerHTML = `
    <div class="text-input-field">
      <div class="single-line-format">
        <rich-textarea><div class="ql-editor" contenteditable="true"><p></p></div></rich-textarea>
      </div>
      <div class="leading-actions-wrapper"><button aria-label="Open upload file menu"></button></div>
      <div class="trailing-actions-wrapper" id="gemini-row" style="${ROW}">
        <div class="model-picker-container" id="gemini-model-group">
          <bard-mode-switcher><div style="${COLUMN}">
            <button aria-label="Open mode picker, currently Flash Extended">Flash</button>
            <gem-popover></gem-popover>
          </div></bard-mode-switcher>
        </div>
        <div class="input-buttons-wrapper-bottom persistent-mic" id="gemini-mic-group" style="${ROW}">
          <speech-dictation-mic-button>
            <div class="gem-mic-button-wrapper">
              <button id="gemini-mic" aria-label="Dictate"></button>
            </div>
          </speech-dictation-mic-button>
          <button id="gemini-send" aria-label="Send message"></button>
        </div>
      </div>
    </div>`;
}

/** grok: bottom row with attach on the left and an ms-auto group on the right. */
function mountGrok(): void {
  document.body.innerHTML = `
    <div class="composer">
      <div class="tiptap ProseMirror" contenteditable="true"><p></p></div>
      <div id="grok-row" style="${ROW}">
        <div class="attach"><button aria-label="Attach"></button></div>
        <div class="ms-auto" id="grok-right-group" style="${ROW}">
          <button id="grok-model" aria-label="Model select">Fast</button>
          <button aria-label="Dictation"></button>
        </div>
      </div>
    </div>`;
}

/** deepseek: footer row — DeepThink/Search on the left, attach and send right. */
function mountDeepseek(): void {
  document.body.innerHTML = `
    <div class="composer">
      <div class="input-wrap"><textarea placeholder="Message DeepSeek"></textarea></div>
      <div class="footer" id="deepseek-row" style="${ROW}">
        <div class="left" style="${ROW}">
          <div role="button">DeepThink</div>
          <div role="button">Search</div>
        </div>
        <div class="right" id="deepseek-attach-group" style="${ROW}">
          <div role="button" id="attach"></div>
          <input type="file" />
          <div role="button" id="send"></div>
        </div>
      </div>
    </div>`;
}

/**
 * The site control the button ends up sitting immediately to the left of.
 * Asserting on this rather than on the container is what actually pins the
 * placement down: which nesting level the row resolves to is an implementation
 * detail, "nothing between the button and the mic" is the requirement.
 */
function controlAfter(host: HTMLElement): Element | null {
  const controls = [...document.querySelectorAll('button, [role="button"]')];
  return (
    controls.find(
      (c) => (host.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ) ?? null
  );
}

/** Resolve the slot and dock a stand-in host in it, as the content script does. */
function dock(adapter: {
  findInputElement(): HTMLElement | null;
  findButtonSlot(input: HTMLElement): { container: HTMLElement; before?: HTMLElement | null } | null;
}): HTMLElement {
  const slot = adapter.findButtonSlot(adapter.findInputElement()!)!;
  const host = document.createElement('div');
  applySlot(host, slot);
  return host;
}

describe("findButtonSlot — the button docks in the site's own action row", () => {
  it('chatgpt: to the left of the microphone', () => {
    mountChatgpt();
    expect(controlAfter(dock(chatgptAdapter))!.id).toBe('dictation');
  });

  it('chatgpt: falls back to the send button when dictation is absent', () => {
    mountChatgpt();
    document.getElementById('dictation')!.remove();
    expect(controlAfter(dock(chatgptAdapter))!.id).toBe('send');
  });

  it('claude: to the left of the model picker', () => {
    mountClaude();
    const host = dock(claudeAdapter);
    expect(host.parentElement!.id).toBe('claude-row');
    expect(controlAfter(host)!.getAttribute('data-testid')).toBe('model-selector-dropdown');
  });

  it('gemini: to the left of the mode picker, not inside its popover column', () => {
    mountGemini();
    const host = dock(geminiAdapter);
    expect(host.parentElement!.id).toBe('gemini-row');
    expect(host.nextElementSibling!.id).toBe('gemini-model-group');
  });

  it('gemini: falls back to the mic when the build renders no mode picker', () => {
    // Reported live from a `?is_sa=1&campaign_id=…` landing: the trailing row
    // drops its `.with-model-picker` half, every picker landmark misses, and the
    // button was hidden with "found the composer but not its action row".
    mountGemini();
    document.getElementById('gemini-model-group')!.remove();
    const host = dock(geminiAdapter);
    expect(controlAfter(host)!.id).toBe('gemini-mic');
  });

  it('grok: up against the model/speed pill, not at the far end of the row', () => {
    mountGrok();
    const host = dock(grokAdapter);
    // The pill's group is `ms-auto`: docking in the outer row would leave the
    // button stranded on the left with all the free space between them.
    expect(host.parentElement!.id).toBe('grok-right-group');
    expect(controlAfter(host)!.id).toBe('grok-model');
  });

  it('deepseek: to the left of the attach button', () => {
    mountDeepseek();
    expect(controlAfter(dock(deepseekAdapter))!.id).toBe('attach');
  });

  it('returns null when the composer has no recognisable action row', () => {
    document.body.innerHTML =
      '<div class="composer"><div id="prompt-textarea" contenteditable="true"><p></p></div></div>';
    const input = chatgptAdapter.findInputElement()!;
    expect(chatgptAdapter.findButtonSlot(input)).toBeNull();
  });

  it('ignores a landmark that belongs to another part of the page', () => {
    // A model picker in the page header must not drag the button out of the
    // composer — the search is scoped to the composer's own subtree.
    document.body.innerHTML = `
      <header><div class="hdr"><button data-testid="model-selector-dropdown"></button><button></button></div></header>
      <div class="composer"><div class="ProseMirror" contenteditable="true"><p></p></div></div>`;
    const input = claudeAdapter.findInputElement()!;
    expect(claudeAdapter.findButtonSlot(input)).toBeNull();
  });
});

describe('applySlot', () => {
  function slotFor(): { host: HTMLElement; slot: ReturnType<typeof claudeSlot> } {
    mountClaude();
    return { host: document.createElement('div'), slot: claudeSlot() };
  }
  const claudeSlot = () => claudeAdapter.findButtonSlot(claudeAdapter.findInputElement()!)!;

  it('inserts the host immediately before the landmark', () => {
    const { host, slot } = slotFor();
    expect(applySlot(host, slot)).toBe(true);
    expect(host.parentElement!.id).toBe('claude-row');
    expect(host.nextElementSibling!.id).toBe('claude-model-group');
  });

  it('is idempotent — a second call leaves exactly one node in place', () => {
    const { host, slot } = slotFor();
    applySlot(host, slot);
    expect(applySlot(host, slot)).toBe(false);
    expect(slot.container.querySelectorAll('[data-host]').length).toBe(0);
    expect([...slot.container.children].filter((c) => c === host)).toHaveLength(1);
  });

  it('re-inserts the host after the site re-renders the row', () => {
    const { host } = slotFor();
    applySlot(host, claudeSlot());
    // React replacing the composer drops our node with it.
    mountClaude();
    expect(host.isConnected).toBe(false);
    expect(applySlot(host, claudeSlot())).toBe(true);
    expect(host.nextElementSibling!.id).toBe('claude-model-group');
  });

  it('appends when the landmark has already left the row', () => {
    const { host, slot } = slotFor();
    document.getElementById('claude-model-group')!.remove();
    expect(applySlot(host, slot)).toBe(true);
    expect(host.parentElement!.id).toBe('claude-row');
    expect(host.nextElementSibling).toBeNull();
  });
});

describe('styleSourceFor', () => {
  it('picks a real control out of the group we insert next to', () => {
    mountClaude();
    const source = styleSourceFor(claudeAdapter.findButtonSlot(claudeAdapter.findInputElement()!)!);
    expect((source as HTMLElement).getAttribute('data-testid')).toBe('model-selector-dropdown');
  });

  it('accepts div[role=button] controls, which is all deepseek has', () => {
    mountDeepseek();
    const source = styleSourceFor(
      deepseekAdapter.findButtonSlot(deepseekAdapter.findInputElement()!)!,
    );
    expect((source as HTMLElement).id).toBe('attach');
  });
});
