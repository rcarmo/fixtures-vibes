# General maximum iterations

General Instance Configuration adds runtime-capability-gated `maxIterations`,
fallback 128, integer bounds 1–2147483647. Edits debounce 800ms and send only
changed fields. Busy saves disable both steppers; failed saves surface an alert
and revert unsaved values. Pending debounce and notices are cleaned on unmount.
The help text explains instance-wide persistence, next-turn activation and no
restart; running turns retain their captured limit. Upload-only hosts continue
to show their existing upload control.

Verification: `make test` 209/209 across 59 files, `make check`, `make build`.
Profiled `make check-appearance-identity` passes at Chromium 1440px/390px with
zero retries: default/save/reopen, upload preservation, failed-save rollback,
unmount cancellation and old-host compatibility plus appearance/identity/ruler
regressions. CPU is dominated by runner/accessibility queries and browser
idle/program frames. Browser sampled live allocations 41.7/43.3MiB mostly belong
to injected role queries; xterm measurement is ~20.8ms desktop. Bundled script
URLs have no repository source mapping, so do not read the summary's zero
repository-frame count as zero application CPU. Bun exit heap is not allocation
history. No measured General autosave outlier was identified; do not weaken
semantic selectors to improve harness timing. Raw profiles were analysed and
removed. These are source-built component checks, not full runtime/WebKit
compliance; Gi owns real General API persistence/turn activation coverage.
