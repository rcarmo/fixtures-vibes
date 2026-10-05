# Vibes web front-end (consumed by Vibes through references/fixtures-vibes/ui/vibes).
BUN ?= bun
RUN_PURPOSE ?= ui-vibes
include ../../mk/project-paths.mk
.PHONY: deps build test lint browser
deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) scripts/build-vendor.mjs
	$(BUN) run build.js
test: deps
	$(BUN) test ./tests/unit/
lint: deps
	$(BUN) run lint:frontend
browser: deps
	for f in tests/browser/*.mjs; do $(BUN) $$f || exit 1; done
