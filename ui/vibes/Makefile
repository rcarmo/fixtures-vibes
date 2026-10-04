# Vibes web front-end (consumed by Vibes through references/fixtures-vibes/ui/vibes).
BUN ?= bun
.PHONY: deps build test lint
deps:
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) run build.js
test: deps
	$(BUN) test tests/frontend
lint: deps
	$(BUN) run lint:frontend
