# Shared Classic web UI (consumed through references/fixtures-vibes/ui/classic).
BUN ?= bun
.PHONY: deps build test check
deps:
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) run build.js
test: deps
	$(BUN) test ./tests/unit/
check: deps
	$(BUN) run scripts/check-hook-tdz.ts
