# Shared Classic web UI (consumed through references/fixtures-vibes/ui/classic).
BUN ?= bun
RUN_PURPOSE ?= ui-classic
include ../../mk/project-paths.mk
include ../../mk/profiling.mk
.PHONY: deps build test check check-revisions
deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) run build.js
test: deps
	$(profile_begin)
	$(BUN_TEST_PROFILED) ./tests/unit/; s=$$?; $(profile_summary); exit $$s
check: deps
	$(BUN) run scripts/check-hook-tdz.ts
# Isolated adapter fixture checks; not runtime compliance. Profile only for pre-release verification.
check-revisions: deps
	$(profile_begin)
	REVISION_BROWSER_PROFILE_DIR="$(if $(filter 1,$(PROFILING)),$(PROFILE_DIR),)" $(BUN) $(BUN_PROFILE) run scripts/check-revision-browser.ts; s=$$?; $(profile_summary); exit $$s
