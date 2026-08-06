/** Where the button's top-left corner should land, in viewport pixels. */
export interface ButtonPosition {
  top: number;
  left: number;
}

/**
 * Site-owned placement logic. Given the resolved input element and the
 * button's own rendered size, return where to put it. Has full access to
 * the input's DOM (and can walk to other elements on the page) so each site
 * can account for its own layout quirks instead of fitting one shared formula.
 */
export type PositionButton = (
  input: HTMLElement,
  buttonSize: { width: number; height: number },
) => ButtonPosition;

/** Contract every site adapter implements. Adapters stay isolated from shared logic. */
export interface SiteAdapter {
  /** Stable identifier, e.g. "chatgpt". */
  siteId: string;
  /** Custom button placement for this site's DOM; omit to use the shared default. */
  positionButton?: PositionButton;
  /**
   * Route gate: false on sections of the site that aren't a chat page (e.g.
   * a full-page settings screen). Re-evaluated on every reposition, so it must
   * read the *current* location. Omit when every route on the host that has a
   * matching input is a chat page.
   */
  isSupportedPage?(): boolean;
  /** Locate the prompt input element on the page, or null if not found. */
  findInputElement(): HTMLElement | null;
  /** Read the current prompt text from the input element. */
  getText(el: HTMLElement): string;
  /**
   * Replace the prompt text, dispatching the input/change events the site's
   * framework needs to recognize the change (a plain .value assignment is not enough).
   */
  setText(el: HTMLElement, text: string): void;
}
