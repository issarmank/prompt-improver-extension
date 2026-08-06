// Shared helper for plain-textarea composers on React sites (chatgpt.com's
// legacy variant, grok.com's legacy variant, chat.deepseek.com). Site adapters
// stay isolated: they only call into this module.

/**
 * React overrides `value` per element to track user input, so a plain
 * assignment is invisible to it. Writing through the native prototype setter
 * and then firing a bubbling input event makes React re-read the value.
 */
export function setTextareaText(el: HTMLTextAreaElement, text: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
