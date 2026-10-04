# tau-prime web front-end (consumed by tau-prime through references/fixtures-vibes/ui/tau).
BUN ?= bun
.PHONY: deps build test lint
deps:
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) scripts/build-vendor.mjs
	$(BUN) run build.js
test: deps
	$(BUN) test ./tests/
lint: deps
	$(BUN) run lint:frontend
