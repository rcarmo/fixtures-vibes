# Gi web front-end (consumed by Gi through references/fixtures-vibes/ui/gi).
BUN ?= bun
.PHONY: deps build test check
deps:
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) run build.js
test: deps
	$(BUN) test tests/ux/support
check: deps
	$(BUN) run scripts/check-hook-tdz.ts
