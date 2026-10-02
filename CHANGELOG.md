# Changelog

## v0.1.0-rc.1

- Classic Gherkin: 267 scenarios with preserved `@ux-<area>-NNN` IDs and 29 shared scenarios minted as `@ux-shared-001..029`.
- `@cap-*` vocabulary (`capabilities.json`); every scenario carries the capabilities it needs.
- Schemas for runtime profiles, skips files and evidence manifests.
- Deterministic fixture model with a control API (gates, reasoning, tools, usage, failures).
- Bun/Playwright compliance suite with lifecycle or external runtimes, automatic capability skips and a report gate.
- Reference profile for Piclaw 3.2.5. 43 scenarios are tagged `@reconcile-3.2.5` pending oracle review.
