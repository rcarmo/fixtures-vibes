// Widget isolation (Rui, 2026-10-04): generated widgets run without same-origin access, and the host accepts bridge
// messages only from the widget's own iframe. Deliberate divergence from Piclaw (3.2.5 and later), which grants
// allow-same-origin and trusts any message carrying a matching widget key.
const replaceOnce = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw new Error(`widget isolation anchor missing or not unique: ${label}`);
  return source.replace(anchor, replacement);
};

export function patchWidgetSandbox(source) {
  return replaceOnce(source, "? 'allow-downloads allow-scripts allow-same-origin allow-forms'", "? 'allow-downloads allow-scripts allow-forms'", 'sandbox');
}

export function patchWidgetMessageSource(source) {
  return replaceOnce(source,
    'if (!incomingKey && iframe?.contentWindow && event.source !== iframe.contentWindow) return;',
    'if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;',
    'message source');
}
