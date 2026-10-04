# tau-prime web front-end (consumed by tau-prime through references/fixtures-vibes/ui/tau).
# vibes/ is the imported Vibes front-end; static/ holds the shared extension/widget SDK files it also serves.
BUN ?= bun
.PHONY: deps build test lint
deps:
	cd vibes && $(BUN) install --frozen-lockfile
build: deps
	cd vibes && $(BUN) run build.js
test: deps
	cd vibes && $(BUN) test tests
lint: deps
	cd vibes && $(BUN) run lint:frontend
