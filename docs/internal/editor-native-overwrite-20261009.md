# Native editor overwrite confirmation

Gi's editor adaptation now uses the owning window's browser confirmation for Overwrite. The shared workspace018 test already accepts browser dialogs, including Reload's discard confirmation. Its source and assertions remain unchanged.

The confirmation contains the path and complete fetched saved text. Only explicit approval authorises a PUT with that snapshot's revision. Cancellation, a suppressed dialog or a detached document authorises no write. Incomplete snapshots fail before confirmation. A change after review must still return a conflict; no automatic retry or unconditional-write fallback is added. Create-only Save Copy and normal-save baselines are unchanged.

This replaces the additional HTML Review overwrite dialog, which the shared test did not approve. Piclaw 3.3.0's vendored conflict monitor calls its normal save action directly; that release does not have the additional HTML dialog. No oracle record is rewritten. The remote Piclaw reference is unreachable from this workspace, so no new oracle run is claimed.

Verification before consumer adoption: 166 Classic UI unit tests (1,046 assertions) and 26 suite unit tests (355 assertions) pass; UI build and hook TDZ checks pass. Tests cover explicit consent, complete snapshot text, numeric-zero revisions and failure without a document window. Consumer browser acceptance is recorded by Gi after submodule adoption.

Pre-release Bun profiling shows 73 ms sampled CPU and 5,049 KiB live heap across the UI unit workload. Transpilation/module loading dominates; the endpoint heap is not allocation history. No matched performance improvement is claimed. Raw captures were analysed by the summary helper and deleted immediately afterwards.
