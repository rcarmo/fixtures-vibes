# Editor loader revision forwarding

F1 forwards the third `setContent` argument through the actual Piclaw lazy
proxy via `patchEditorLoaderRevision`. Vendored source remains unchanged;
checked anchors reject drift/duplicate application. Missing revisions continue
to reach the real editor and lock out writes. Generated shared assets are
rebuilt; Gi independently tests adoption.

Verification: 16 focused revision/actual-proxy tests, 72 assertions pass.
The initial unpatched-proxy probe failed with two arguments instead of three.
Actual proxy-to-adapted-editor tests preserve integer zero and clear invalid
revision. Mounted Chromium desktop/WebKit phone editor and Plan workloads
pass 4/4 with zero retries, now using the real lazy proxy, including complete
external refresh. Build/vendor integrity and hook TDZ checks pass.

Gi candidate005915c consumer checks pass 4/4 (Chromium/WebKit desktop), including
actual workspace-update SSE next-save revision, reviewed overwrite cancellation,
conditional approval and create-only Save Copy. A profiled repeat passes.
Unchanged shared workspace018 still fails after its unapproved Review overwrite
dialog: tab remains dirty, then cleanup times out. No spec assertion was changed
and no capability/skip/issue closure follows from the consumer passes.

Full shared unit run fails: 158 pass, 2 fail, 1 error. Meter imports resolve a
vendored stub rather than the overlay API/Preact; isolated baseline main also
fails meter import resolution. Upload cancellation assertion fails in the full
suite but passes in isolation; no upload code changed here. These are separate
harness/isolation follow-ups, not passing aggregate evidence.

Profiling: focused Bun CPU14 samples/14ms concentrates in transpilation; live
heap1369KiB/10141 objects is a snapshot, not allocation history. Mounted Chromium
sampled allocation7321KiB, CPU168ms; no source-attributed hot allocation or
matched speedup established. Runner CPU3729ms/live heap31873KiB. WebKit is
functional-only. Profiles/raw fixture output are deleted after analysis; keep
only these conclusions. Worktree/source stays until serial integration ends.
