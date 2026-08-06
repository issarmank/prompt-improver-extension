/**
 * Where inside the site's own composer action row the button belongs — the row
 * that already holds the model picker, mic and send controls. The button is
 * inserted as a real child of that row, so the site's layout scrolls, clips,
 * hides and themes it for free.
 */
export interface ButtonSlot {
  /** The action row to insert into. */
  container: HTMLElement;
  /** Insert immediately before this child of `container`; appended last when null. */
  before?: HTMLElement | null;
}

/** Contract every site adapter implements. Adapters stay isolated from shared logic. */
export interface SiteAdapter {
  /** Stable identifier, e.g. "chatgpt". */
  siteId: string;
  /**
   * Route gate: false on sections of the site that aren't a chat page (e.g.
   * a full-page settings screen). Re-evaluated on every mount check, so it must
   * read the *current* location. Omit when every route on the host that has a
   * matching input is a chat page.
   */
  isSupportedPage?(): boolean;
  /** Locate the prompt input element on the page, or null if not found. */
  findInputElement(): HTMLElement | null;
  /**
   * Resolve the composer's action row for an already-found input. Returns null
   * when this build of the site has no row we recognise — the button then does
   * not render at all, rather than falling back to floating over the page.
   */
  findButtonSlot(input: HTMLElement): ButtonSlot | null;
  /** Read the current prompt text from the input element. */
  getText(el: HTMLElement): string;
  /**
   * Replace the prompt text, dispatching the input/change events the site's
   * framework needs to recognize the change (a plain .value assignment is not enough).
   */
  setText(el: HTMLElement, text: string): void;
}
