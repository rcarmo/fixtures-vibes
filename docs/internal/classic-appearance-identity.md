# Classic appearance and post identity

## Refinement and scope

Rui requested colour swatches first, then configured assistant names followed by a separate `@session` bubble, as the shared Classic default, plus an active-session browser title. Frontend changes are explicitly authorised here; preserve Gi's existing dirty bundles and the unmodified vendored Piclaw sources. No backend identity/persistence changes, live name activation, agent coordination or instance restart.

## Checklist

- [x] Show catalogue colour previews for every preset, including Default's light/dark palettes.
- [x] Keep runtime-configured assistant identity and avatar across session refreshes; show the post's own session as a separate bubble.
- [x] Reflect the selected session in the tab title (`@session — Gi`), including switch/rename and loading fallback.
- [x] Match xterm's overview-ruler border to the terminal background, preserving scrolling/search markers.
- [x] Test palette selection, session refresh/rename, fallback names, user/system posts and search links.
- [x] Run source checks sequentially; leave Gi's existing generated bundles untouched.

## Development verification

- `make test`: 209 tests across 59 files, 0 failures; palette values match the shared catalogue, checked adapters fail closed, selection/rename and title fallbacks are deterministic.
- `make check-appearance-identity`: Chromium desktop (1440px) and phone (390px), 2/2 pass, zero retries. Actual Appearance/Timeline/Post components are built from source; checks cover visible palettes without horizontal overflow, theme persistence, configured identity, per-chat bubbles, rename/title switch and search reference actions. The actual xterm canvas's ruler border pixel matches terminal backgrounds in light/dark mode; scrollback still works. The line was xterm's default white `overviewRulerBorder`, not a CSS pane border. This is an isolated component fixture, not full runtime compliance or Piclaw oracle acceptance.
- `make check`: no hook dependency TDZ violations. `make build`: complete in the separate upstream worktree, including hashed chunks and CSS compression; vendored Piclaw checksum verification passes.
- Existing Chromium's full executable exited with SIGTRAP before page creation; its installed headless-shell executable succeeded. The first component probe used an incorrect abbreviated theme label; corrected to catalogue label `Monokai Original`. Disposable probes are cleaned after diagnosis.
- These are focused development checks, not a pre-release profiling/compliance claim. The new browser target supports `PROFILING=1` (Bun CPU/heap and Chromium CPU/sampled allocations) for later pre-release analysis/disposal. WebKit/full runtime acceptance remains separate. Gi's dirty submodule assets are preserved; no server restarted.

## Acceptance

Appearance previews are visible without opting in, have accessible palette labels/colour tooltips, and remain visible at phone widths. Changing themes keeps existing browser-local persistence. Session picker names remain session names; timeline authors use active runtime identity (saved changes still require the documented manual restart). Search keeps its existing message-reference action without duplicate bubbles. No extra runtime requests or shared-suite weakening.
