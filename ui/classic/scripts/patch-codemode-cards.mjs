// Codemode cards (#30) render as an accessory on the matching post. The card data is
// projected by Classic (never by the vendored renderer), so this adapter only wires the
// literal-text renderer in; vendored bytes stay otherwise unchanged.
export function patchCodemodeCards(source) {
    const edits = [
        ["import { buildPostMarkdownCopyPayload } from '../utils/post-copy-markdown.js';",
            "import { renderCodemodeCard } from '../gi-codemode-cards.js';\nimport { buildPostMarkdownCopyPayload } from '../utils/post-copy-markdown.js';"],
        ["                ${accessory}",
            "                ${accessory}${renderCodemodeCard(post, html)}"],
    ];
    for (const [from, to] of edits) {
        if (source.split(from).length !== 2) throw Error('Codemode card anchor changed: ' + from);
        source = source.replace(from, to);
    }
    return source;
}
