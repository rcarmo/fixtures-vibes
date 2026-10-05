# Project-scoped caches and scratch, included by every fixtures-vibes Makefile.
#
# Layout: $(PROJECT_TMP_ROOT)/{cache/<tool>,build,runs/<purpose>/<run-id>}. The root defaults to this project's
# (fixtures-vibes). A runtime that runs the suite or builds a UI from its submodule names itself, so the scratch is the
# runtime's: `make -C references/fixtures-vibes compliance PROJECT_NAME=gi [PROJECT_TMP_ROOT=/workspace/tmp/gi] PROFILE=...`. Direct commands load the same settings with `eval "$(make -s -C <repo> env)"`.
#
# Installed toolchains are not scratch: Playwright's browsers stay where `make deps` installed them.

fixtures_vibes_default_goal := $(.DEFAULT_GOAL)
FIXTURES_VIBES_MK := $(dir $(lastword $(MAKEFILE_LIST)))
BUN ?= bun
PROJECT_NAME ?= fixtures-vibes
# Resolved once (mk/project-tmp.mjs: explicit PROJECT_TMP_ROOT, else /workspace/tmp, RUNNER_TEMP, TMPDIR or the platform
# temp directory, each + /$(PROJECT_NAME)); an explicit unusable root fails. Sub-makes and recipes inherit the
# resolved root, so a run directory used as TMPDIR is never resolved into again.
fixtures_vibes_tmp_root := $(shell $(if $(PROJECT_TMP_ROOT),PROJECT_TMP_ROOT='$(PROJECT_TMP_ROOT)') PROJECT_NAME='$(PROJECT_NAME)' $(BUN) $(FIXTURES_VIBES_MK)project-tmp.mjs root)
ifeq ($(fixtures_vibes_tmp_root),)
$(error PROJECT_TMP_ROOT could not be resolved (see the message above))
endif
override PROJECT_TMP_ROOT := $(fixtures_vibes_tmp_root)
CACHE_ROOT := $(PROJECT_TMP_ROOT)/cache
BUILD_ROOT := $(PROJECT_TMP_ROOT)/build
RUN_PURPOSE ?= make
# One id per top-level make invocation, shared with sub-makes.
ifndef RUN_ID
RUN_ID := $(shell date -u +%Y%m%dT%H%M%SZ)-$(shell od -An -N3 -tx1 /dev/urandom | tr -d ' \n')
endif
RUN_DIR := $(PROJECT_TMP_ROOT)/runs/$(RUN_PURPOSE)/$(RUN_ID)

export PROJECT_TMP_ROOT PROJECT_NAME RUN_ID
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

# Create the run's directories, checking each level (mk/project-tmp.mjs); the suite checks FIXTURES_RUN_ROOT again.
define tmp_init
	@$(BUN) $(FIXTURES_VIBES_MK)project-tmp.mjs init '$(RUN_PURPOSE)' '$(RUN_ID)' >/dev/null
	@mkdir -p "$(XDG_CACHE_HOME)" "$(BUN_INSTALL_CACHE_DIR)" "$(npm_config_cache)" "$(GOCACHE)"
endef

.PHONY: env
env:
	@printf 'export %s=%s\n' PROJECT_TMP_ROOT '$(PROJECT_TMP_ROOT)' PROJECT_NAME '$(PROJECT_NAME)' RUN_ID '$(RUN_ID)' FIXTURES_RUN_ROOT '$(FIXTURES_RUN_ROOT)' \
		TMPDIR '$(TMPDIR)' TMP '$(TMP)' TEMP '$(TEMP)' XDG_CACHE_HOME '$(XDG_CACHE_HOME)' \
		BUN_INSTALL_CACHE_DIR '$(BUN_INSTALL_CACHE_DIR)' npm_config_cache '$(npm_config_cache)' GOCACHE '$(GOCACHE)' \
		PLAYWRIGHT_BROWSERS_PATH '$(PLAYWRIGHT_BROWSERS_PATH)'
	$(tmp_init)

# Including this file does not change the includer's default goal.
.DEFAULT_GOAL := $(fixtures_vibes_default_goal)
