# Consumer entry points. Run from a runtime repository as:
#   make -C references/fixtures-vibes deps
#   make -C references/fixtures-vibes compliance PROFILE=$PWD/tests/fixtures-vibes/profile.json
BUN ?= bun
NODE ?= node
PROFILE ?=
PROJECT ?=
PLAYWRIGHT = $(NODE) node_modules/@playwright/test/cli.js

.PHONY: deps test compliance suite report manifest

deps:
	$(BUN) install --frozen-lockfile
	$(PLAYWRIGHT) install chromium webkit

test:
	$(BUN) test tests

suite:
	@test -n "$(PROFILE)" || { echo "PROFILE=/absolute/path/to/profile.json is required"; exit 2; }
	rm -f test-results/compliance.json test-results/compliance-report-*.json test-results/compliance-report-*.md test-results/evidence-*.json
	FIXTURES_PROFILE="$(PROFILE)" $(PLAYWRIGHT) test -c suite/playwright.config.ts $(if $(PROJECT),--project $(PROJECT),) || true

report:
	@test -n "$(PROFILE)" || { echo "PROFILE=/absolute/path/to/profile.json is required"; exit 2; }
	FIXTURES_PROFILE="$(PROFILE)" FIXTURES_VIBES_REF="$$(git describe --tags --always --dirty 2>/dev/null || echo local)" $(BUN) suite/report.ts

# Suite failures are judged by the report gate, which also checks skips and capability claims.
compliance: suite report

manifest:
	$(BUN) tools/manifest.ts
