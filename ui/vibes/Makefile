# Vibes web front-end (consumed by Vibes through references/fixtures-vibes/ui/vibes).
BUN ?= bun
RUN_PURPOSE ?= ui-vibes
include ../../mk/project-paths.mk
include ../../mk/profiling.mk
.PHONY: deps build test lint browser
deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) scripts/build-vendor.mjs
	$(BUN) run build.js
test: deps
	$(profile_begin)
	$(BUN_TEST_PROFILED) ./tests/unit/; s=$$?; $(profile_summary); exit $$s
lint: deps
	$(BUN) run lint:frontend
browser: deps
	$(profile_begin)
	s=0; for f in tests/browser/*.mjs; do $(BUN) $(BUN_PROFILE) $$f || { s=$$?; break; }; done; $(profile_summary); exit $$s
