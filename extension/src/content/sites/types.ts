/** Contract every site adapter implements. Adapters stay isolated from shared logic. */
export interface SiteAdapter {
  /** Stable identifier, e.g. "chatgpt". */
  siteId: string;
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
