# Shared Classic web UI (consumed through references/fixtures-vibes/ui/classic).
BUN ?= bun
RUN_PURPOSE ?= ui-classic
include ../../mk/project-paths.mk
.PHONY: deps build test check
deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) run build.js
test: deps
	$(BUN) test ./tests/unit/
check: deps
	$(BUN) run scripts/check-hook-tdz.ts
