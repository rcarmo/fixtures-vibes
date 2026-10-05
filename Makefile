# Consumer entry points. Run from a runtime repository as:
#   make -C references/fixtures-vibes deps
#   make -C references/fixtures-vibes compliance PROFILE=$PWD/tests/fixtures-vibes/profile.json
BUN ?= bun
NODE ?= node
PROFILE ?=
PROJECT ?=
PLAYWRIGHT = $(NODE) node_modules/@playwright/test/cli.js
RUN_PURPOSE ?= suite
include mk/project-paths.mk

.PHONY: deps test compliance suite report manifest oracle clean-scratch

deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
	$(PLAYWRIGHT) install chromium webkit

test:
	$(tmp_init)
	$(BUN) test ./tests/

suite:
	@test -n "$(PROFILE)" || { echo "PROFILE=/absolute/path/to/profile.json is required"; exit 2; }
	$(tmp_init)
	rm -f test-results/compliance.json test-results/compliance-report-*.json test-results/compliance-report-*.md test-results/evidence-*.json
	FIXTURES_PROFILE="$(PROFILE)" $(PLAYWRIGHT) test -c suite/playwright.config.ts $(if $(PROJECT),--project $(PROJECT),) || true

report:
	@test -n "$(PROFILE)" || { echo "PROFILE=/absolute/path/to/profile.json is required"; exit 2; }
	$(tmp_init)
	FIXTURES_PROFILE="$(PROFILE)" FIXTURES_VIBES_REF="$$(git describe --tags --always --dirty 2>/dev/null || echo local)" $(BUN) suite/report.ts

# Suite failures are judged by the report gate, which also checks skips and capability claims.
compliance: suite report

manifest:
	$(tmp_init)
	$(BUN) tools/manifest.ts

# Record the last reference run (gate must be OK) as immutable dated evidence under oracle/.
oracle:
	@test -n "$(PROFILE)" || { echo "PROFILE=/absolute/path/to/profile.json is required"; exit 2; }
	$(tmp_init)
	FIXTURES_PROFILE="$(PROFILE)" FIXTURES_VIBES_REF="$$(git describe --tags --always 2>/dev/null || echo local)" $(BUN) tools/record-oracle.ts

# Removes this project's disposable scratch and build output only; caches and retained evidence (test-results/, oracle/)
# stay. Refuses any other project's root.
clean-scratch:
	@case "$(PROJECT_TMP_ROOT)" in */fixtures-vibes) ;; *) echo "clean-scratch only cleans fixtures-vibes' own root" >&2; exit 1;; esac
	rm -rf -- "$(PROJECT_TMP_ROOT)/runs" "$(BUILD_ROOT)"
