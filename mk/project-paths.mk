# Project-scoped caches and scratch, included by every fixtures-vibes Makefile.
#
# Layout: $(PROJECT_TMP_ROOT)/{cache/<tool>,build,runs/<purpose>/<run-id>}. The default root is this project's
# (/workspace/tmp/fixtures-vibes). A runtime that runs the suite or builds a UI from its submodule passes its own root,
# e.g. `make -C references/fixtures-vibes compliance PROJECT_TMP_ROOT=/workspace/tmp/gi PROFILE=...`, so the scratch
# belongs to the runtime. Direct commands load the same settings with `eval "$(make -s -C <repo> env)"`.
#
# Installed toolchains are not scratch: Playwright's browsers stay where `make deps` installed them.

fixtures_vibes_default_goal := $(.DEFAULT_GOAL)
PROJECT_TMP_ROOT ?= /workspace/tmp/fixtures-vibes
CACHE_ROOT := $(PROJECT_TMP_ROOT)/cache
BUILD_ROOT := $(PROJECT_TMP_ROOT)/build
RUN_PURPOSE ?= make
# One id per top-level make invocation, shared with sub-makes.
ifndef RUN_ID
RUN_ID := $(shell date -u +%Y%m%dT%H%M%SZ)-$(shell od -An -N3 -tx1 /dev/urandom | tr -d ' \n')
endif
RUN_DIR := $(PROJECT_TMP_ROOT)/runs/$(RUN_PURPOSE)/$(RUN_ID)

export PROJECT_TMP_ROOT RUN_ID
export FIXTURES_RUN_ROOT := $(RUN_DIR)
export TMPDIR := $(RUN_DIR)/tmp
export TMP := $(TMPDIR)
export TEMP := $(TMPDIR)
export XDG_CACHE_HOME := $(CACHE_ROOT)/xdg
export BUN_INSTALL_CACHE_DIR := $(CACHE_ROOT)/bun
export npm_config_cache := $(CACHE_ROOT)/npm
export GOCACHE := $(CACHE_ROOT)/go
# XDG_CACHE_HOME would otherwise move Playwright's browser lookup.
export PLAYWRIGHT_BROWSERS_PATH ?= $(HOME)/.cache/ms-playwright

# Create the run's directories, refusing a symlinked or foreign-owned root (the suite checks FIXTURES_RUN_ROOT again).
define tmp_init
	@set -eu; root="$(PROJECT_TMP_ROOT)"; \
	case "$$root" in /*) ;; *) echo "PROJECT_TMP_ROOT must be absolute: $$root" >&2; exit 1;; esac; \
	for path in "$$root" "$$root/cache" "$$root/build" "$$root/runs" "$$root/runs/$(RUN_PURPOSE)"; do \
		test ! -L "$$path" || { echo "Refusing symlink scratch path: $$path" >&2; exit 1; }; \
		if test -e "$$path"; then test -d "$$path" && test -O "$$path" || { echo "Scratch path must be an owned directory: $$path" >&2; exit 1; }; fi; \
	done; \
	mkdir -p "$(TMPDIR)" "$(XDG_CACHE_HOME)" "$(BUN_INSTALL_CACHE_DIR)" "$(npm_config_cache)" "$(GOCACHE)" "$(BUILD_ROOT)"
endef

.PHONY: env
env:
	@printf 'export %s=%s\n' PROJECT_TMP_ROOT '$(PROJECT_TMP_ROOT)' RUN_ID '$(RUN_ID)' FIXTURES_RUN_ROOT '$(FIXTURES_RUN_ROOT)' \
		TMPDIR '$(TMPDIR)' TMP '$(TMP)' TEMP '$(TEMP)' XDG_CACHE_HOME '$(XDG_CACHE_HOME)' \
		BUN_INSTALL_CACHE_DIR '$(BUN_INSTALL_CACHE_DIR)' npm_config_cache '$(npm_config_cache)' GOCACHE '$(GOCACHE)' \
		PLAYWRIGHT_BROWSERS_PATH '$(PLAYWRIGHT_BROWSERS_PATH)'
	$(tmp_init)

# Including this file does not change the includer's default goal.
.DEFAULT_GOAL := $(fixtures_vibes_default_goal)
