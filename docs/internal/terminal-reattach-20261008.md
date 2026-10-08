# WebKit terminal reattachment

Gi's server-owned PTY can resume after a detached host closes. F2 adapts
Piclaw's Safari-only disable/manual-recovery guards through checked build
anchors, retaining the400ms delayed close recovery and existing instance IDs,
handoff tokens and non-live terminal transfer. Reattach messages additionally
require the current detached window as source. Vendored bytes remain unchanged.

Baseline unchanged shared terminal006 fails WebKit3/3. Candidate928eeca shared
Chromium/WebKit desktop passes6/6 (three each, zero retries); independent Gi
consumer passes6/6 preserving shell PID, environment, unsent terminal input,
composer draft and one connected client. A forged same-origin stale sender
cannot reattach the current popup. Affected terminal001/004/007/workspace014
checks pass8/8. Touch exclusions are unchanged. Final publication needs final-pin
consumer repetition; broader terminal acceptance and issue closure are separate.

Focused guard/proxy units5pass16assertions, hook TDZ/vendor build pass. Native
Gi WebTerminal7 tests pass plus race repetitionsx3. An initial wrong native
filter selected0 tests; excluded from evidence. Initial consumer probes failed
on harness imports/selectors and accidentally opening a second dock terminal;
only the corrected original-tab popout workload supplies continuity evidence.
A source-window anchor probe failed build/unit; corrected and rebuilt before
final proof. Tests against the stale built probe are not final acceptance.

Profiled shared6/6 and continuity6/6 inspected runtime/Node/Chromium CPU and
allocation summaries. Native CPU hotspots include replay/process shutdown;
alloc_space includes4MiB replay fixture and2.04MiB each output/replay, alloc_objects
mostly package initialization. Focused Bun3 CPU samples/live heap471KiB is too
short for optimisation claims; live heap is not allocation history. WebKit is
functional-only. No equivalent-workload improvement measured. Used raw profiles,
matching binaries and disposable probe logs/fixtures are removed after analysis,
never copied into evidence. Source worktree remains until integration ends.

No backend protocol, authentication/replay policy, capability, skip, shared
assertion or frozen acceptance gate changed. Full upstream unit failures recorded
in editor-loader-revision-20261008.md have not been fixed by this lane.
