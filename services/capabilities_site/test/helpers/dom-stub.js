// Minimal `document.createElement('div')`-only stub sufficient for the
// escapeHtml()-style `div.textContent = x; div.innerHTML` pattern used across
// modules. Not a full DOM — only supports what these modules actually touch.
export function installDomStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement(tag) {
      let text = '';
      return {
        tagName: tag,
        set textContent(value) { text = value == null ? '' : String(value); },
        get textContent() { return text; },
        get innerHTML() {
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        },
        appendChild() {},
        querySelector() { return null; },
        setAttribute() {},
        removeAttribute() {},
      };
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}
