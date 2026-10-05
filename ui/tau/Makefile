# tau-prime web front-end (consumed by tau-prime through references/fixtures-vibes/ui/tau).
BUN ?= bun
RUN_PURPOSE ?= ui-tau
include ../../mk/project-paths.mk
include ../../mk/profiling.mk
.PHONY: deps build test lint
deps:
	$(tmp_init)
	$(BUN) install --frozen-lockfile
build: deps
	$(BUN) scripts/build-vendor.mjs
	$(BUN) run build.js
test: deps
	$(profile_begin)
	$(BUN_TEST_PROFILED) ./tests/; s=$$?; $(profile_summary); exit $$s
lint: deps
	$(BUN) run lint:frontend
