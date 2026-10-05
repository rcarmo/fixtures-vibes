# Shared Classic web UI (consumed through references/fixtures-vibes/ui/classic).
BUN ?= bun
RUN_PURPOSE ?= ui-classic
include ../../mk/project-paths.mk
include ../../mk/profiling.mk
.PHONY: deps build test check
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
