# tau-prime web front-end (consumed by tau-prime through references/fixtures-vibes/ui/tau).
BUN ?= bun
RUN_PURPOSE ?= ui-tau
include ../../mk/project-paths.mk
.PHONY: deps build test lint
deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) scripts/build-vendor.mjs
	$(BUN) run build.js
test: deps
	$(BUN) test ./tests/
lint: deps
	$(BUN) run lint:frontend
