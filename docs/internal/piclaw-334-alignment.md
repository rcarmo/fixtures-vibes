# Piclaw 3.3.4 frontend alignment

Classic vendors 235 unmodified source files from `v3.3.4-ux`, commit
`78dcfa25838a152fdf936b864306b643b8d1cfbc`. Five standalone viewer pages and their CSPs were extracted from
the same tagged routes. The installed reference and historical oracle records stay at 3.3.0.

## Libraries and build

All direct dependencies in the root, Classic, Vibes and Tau manifests were checked against npm's stable `latest`
on 2026-10-16 and pinned exactly. Updated versions include Preact 11.0.1, Marked 18.1.1, Babel runtime 8.0.7,
CodeMirror language 6.13.1/view 6.43.14/legacy-modes 6.5.5, Playwright 1.64.1, AJV 8.20.0, Pixelmatch 8.0.0 and
axe-core/Playwright 4.14.0. Compatible transitive dependencies were refreshed too. The Vibes lock had vulnerable
brace-expansion 5.0.9; it now resolves 5.0.12. All four `bun audit` runs must pass before publication.

AdaptiveCards 3.0.6 is now declared, locked and rebuilt at the renderer's actual lazy-load URL,
`/static/common/js/vendor/adaptivecards.min.js`. Old SDK output and metadata are removed. Vibes and Tau refresh
their shipped Marked bundles from the lockfile. All 14 checked-in xterm packages already match npm's latest
stable versions. Remote-display WASM/metadata match the tagged upstream assets; this is asset-integrity checking,
not generated-signal equivalence. Fonts and separately pinned Plan sidebar source were retained.

## Integration

Upstream now supplies widget sandbox/source checks and browser-independent terminal recovery, with stronger
source-window and pane-instance admission. The superseded backports are removed; tests exercise upstream's
policy and guards. Revision-safe editor/Plan saves, create-only copies and reviewed overwrite retain their adapters.
The editor's clean external reload also adopts the fetched revision and preserves edits/path/view/mtime changes
that occur during the fetch. About uses `/api/runtime/config` and displays runtime version separately from UI pin.
The native menu keeps its new About action and the existing guarded dismissal adapter.

No backend implementation, consumer gitlink, deployment, shared scenario/skip or oracle record is changed.
Gi adopters must update their viewer-CSP test path to `piclaw/viewers-3.3.4/csp.json`. Static servers need the
existing `/static/` alias for the SDK's common-assets URL. Vibes publication stays on hold; issue #1 is left open.

## Checks and profiling

Toolchain: Bun 1.4.2, Playwright 1.64.1, Chromium 1248 and WebKit 2370 on Linux x64.
All three bundles build; hook-TDZ checks pass. Pre-release units/contracts are profiled with `PROFILING=1`.
`make check-revisions` passes four zero-retry editor/Plan workloads; `make check-release` passes two zero-retry
component workloads on Chromium desktop and WebKit phone. The latter covers Markdown/math sanitisation,
About/runtime versions, composer submission, AdaptiveCards input/actions, isolated widget messages and xterm/fit.
These loopback fixtures test components and adapters; live runtime acceptance and full compliance are separate.

Final Classic unit CPU capture: 69 samples at 1 ms; 5,071 KiB/21,942 live objects at exit. Source verification and
anchored patch checks dominate the small test workload. Vibes: 44 samples, 9,095 KiB live heap; Tau: 44 samples,
2,750 KiB live heap. JSC snapshots contain live objects, not allocation histories.

The release-component Chromium capture sampled 725 ms total, with 83.4 ms self time attributed to loopback
application URLs. Its sampled allocation tree totals 14,611 KiB, with 9,743 KiB attributed to loopback ancestors.
Leading sites are CodeMirror module/extension setup, Marked, KaTeX and xterm initialisation. This workload mounts
one instance of each component; no repeated application hotspot justified a change to the pinned libraries.
The revision workload sampled 172 ms browser CPU and 6,558 KiB allocations. Runner CPU mostly covers
Playwright and module loading. There is no equivalent-workload performance comparison or measured speed-up.
WebKit CPU/allocation capture is unavailable through Playwright. No live runtime/backend profiling is claimed.

Raw profiles, including failed fixture probes, are deleted immediately after analysis. Only these conclusions
are retained. Completed owned fixture/log/cache scratch is removed at the verification boundary; installed
dependencies, browser toolchains and intentional release bundles are preserved.
