# CodeMirror vendor

`codemirror.js` is built from `codemirror-entry.ts` (originally Piclaw's editor viewer entry) by
`scripts/build-vendor.mjs` using the current npm packages in `package.json`; `codemirror.meta.json` records the
versions. One shared bundle serves the editor and fenced-code highlighting, so CodeMirror state is not duplicated.

`../code-highlighting.js` is the TypeScript-stripped Piclaw classic code highlighter, with only the import path adapted
to this bundle. Licences are under `licenses/` (Piclaw MIT, Lezer MIT, CodeMirror and dependency notices).
