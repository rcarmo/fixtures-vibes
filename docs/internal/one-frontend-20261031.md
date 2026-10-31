# One frontend

`ui/classic/` is the only frontend in fixtures-vibes. Rui's 2026-10-31 instruction supersedes the earlier policy
of maintaining Vibes and Tau trees until runtime adoption. The 361 tracked files under `ui/vibes/` and `ui/tau/`
are removed, including their assets, tests, SDK copy, package manifests, locks and build entry points. No alternate
copy, archive or compatibility symlink is added. Git history retains the old revisions.

## Consumer impact

At the origin inspection on 2026-10-31:

| Runtime | Published source wiring | Shared pin | Required action for this revision |
|---|---|---|---|
| Gi | embeds `ui/classic/static` | `b52c1494` | Normal Classic pin/build/acceptance |
| Vibes Python | static symlink targets `ui/vibes/static` | `4259e82` | Implement `ui/API.md`, change build/static paths to Classic, verify before repinning |
| tau-prime | frontend and SDK symlinks target `ui/tau` | `4259e82` | Implement the Classic contract and replace legacy frontend/SDK wiring before repinning |

Updating Vibes or Tau to this revision with their old wiring would break their static/build paths. Older pinned
revisions are unchanged. This change does not implement missing backend routes, migrate consumer repositories,
restart services or lift publication holds. Dirty consumer work and their pins were not touched. No agents were contacted.

## Verification

Root `make test PROFILING=1` passes 28 contract/layout tests and its 209 Classic tests. Classic's separate profiled
unit run passes 209 tests; build and hook-TDZ checks pass. Both zero-retry release component workloads pass on
Chromium desktop/WebKit phone: Markdown/math sanitisation, About, composer, AdaptiveCards, widget isolation and
xterm/FitAddon. The layout test rejects every alternate frontend directory and symlink alias under `ui/`.
Shared specs, skips and historical oracle records are unchanged; no full runtime compliance is claimed.

Contract CPU: 96 samples at 1 ms, dominated by one-time cached AJV schema compilation (46 ms); heap at exit
6,977 KiB. Classic CPU: 120 samples at 1 ms, leading source integrity checks (23 ms) and anchored adapter validation
(14 ms); heap 6,266 KiB. Browser CPU: 1,000 ms sampled, 143.9 ms self time at application URLs, largely CodeMirror
module initialisation. Sampled allocations total 14,399 KiB, with 9,903 KiB attributed to application URL ancestors;
CodeMirror, AdaptiveCards and KaTeX setup lead. There is no measured repeated-work outlier requiring a code change
in this removal. No speed-up is claimed. JSC heaps are live snapshots, not allocation histories; equivalent WebKit
profiling is unavailable through Playwright. Raw captures are disposed after analysis.

The build was verified but its incidental toolchain-dependent chunk changes were discarded: committed Classic
source and release assets are unchanged by this removal. Obsolete local ignored dependencies and completed
verification logs/fixtures are removed at a safe boundary, after checking for live cwd/open-file references.
