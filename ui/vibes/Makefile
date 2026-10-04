# Vibes web front-end (consumed by Vibes through references/fixtures-vibes/ui/vibes).
BUN ?= bun
.PHONY: deps build test lint browser
deps:
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) run build.js
test: deps
	$(BUN) test tests/frontend
lint: deps
	$(BUN) run lint:frontend
browser: deps
	for f in tests/browser/*.mjs; do $(BUN) $$f || exit 1; done
