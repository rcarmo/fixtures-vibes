# Test profiling (Rui, 2026-10-05): profile and tune during pre-release testing, then delete the raw data once it has
# been analysed. Ordinary development runs are not profiled. Included after mk/project-paths.mk.
#
#   make test PROFILING=1                  pre-release run: capture, write summary.txt, print it, delete the raw captures
#   make test PROFILING=1 PROFILE_KEEP=1   keep the raw captures for deeper analysis; delete them with
#                                          `make clean-scratch` (or rm the printed directory) as soon as that is done
#
# Captures are disposable scratch under $(PROJECT_TMP_ROOT)/runs/profiles/<purpose>-<run-id>/: run-<target>.json
# (command, revision, toolchain, sampling settings) and summary.txt from tools/profile-summary.mjs, which separates
# this repository's frames from runner overhead. Keep only the conclusions (workload, revision, result, changes made).
#
# - Node processes (the Playwright runner and its workers): V8 --cpu-prof (1 ms) and --heap-prof (sampling, 512 KiB).
# - Bun scripts: Bun's --cpu-prof and --heap-prof (the latter is a heap snapshot at exit, not allocation sites).
# - bun test (no --cpu-prof in Bun 1.4): mk/bun-test-profile.ts runs JSC's profile() over the whole test process
#   (1 ms samples, FIXTURES_BUN_SAMPLE_US) and writes cpu.json plus a heap snapshot at the end, in bun-test-<pid>/;
#   /usr/bin/time -v adds CPU time and peak RSS. JSC keeps no allocation history (the heap snapshot shows what is
#   live at the end, not bytes or objects allocated), and subprocesses the tests spawn are not profiled.
# - Browsers and the runtime under test are not profiled here; runtime owners profile their own processes.
NODE ?= node
PROFILING ?=
PROFILE_KEEP ?=
ifeq ($(PROFILING),1)
PROFILE_DIR ?= $(PROJECT_TMP_ROOT)/runs/profiles/$(RUN_PURPOSE)-$(RUN_ID)
NODE_PROFILE = NODE_OPTIONS="$$NODE_OPTIONS --cpu-prof --cpu-prof-dir=$(PROFILE_DIR) --heap-prof --heap-prof-dir=$(PROFILE_DIR)"
BUN_PROFILE = --cpu-prof --cpu-prof-dir=$(PROFILE_DIR) --heap-prof --heap-prof-dir=$(PROFILE_DIR)
TIME_V := $(if $(wildcard /usr/bin/time),/usr/bin/time -v -o $(PROFILE_DIR)/time-$$$$.txt,)
BUN_TEST_PROFILED = FIXTURES_PROFILE_DIR="$(PROFILE_DIR)" $(TIME_V) $(BUN) test --preload $(abspath $(FIXTURES_VIBES_MK)bun-test-profile.ts)
define profile_begin
	@mkdir -p "$(PROFILE_DIR)"
	@printf '{"target":"%s","purpose":"%s","run_id":"%s","revision":"%s","bun":"%s","node":"%s","cwd":"%s","node_cpu_interval_us":1000,"node_heap_interval_bytes":524288}\n' \
		'$@' '$(RUN_PURPOSE)' '$(RUN_ID)' "$$(git describe --always --dirty 2>/dev/null || echo unknown)" \
		"$$($(BUN) --version 2>/dev/null)" "$$($(NODE) --version 2>/dev/null)" "$$PWD" > "$(PROFILE_DIR)/run-$@.json"
endef
# Append to the test command on the same recipe line, so the summary is produced even when tests fail:
#   <command>; s=$$?; $(profile_summary); exit $$s
profile_summary = $(NODE) $(abspath $(FIXTURES_VIBES_MK)../tools/profile-summary.mjs) "$(PROFILE_DIR)" > "$(PROFILE_DIR)/summary.txt" 2>&1; \
	cat "$(PROFILE_DIR)/summary.txt"; \
	$(if $(filter 1,$(PROFILE_KEEP)),echo "raw profiles kept for analysis: $(PROFILE_DIR) (delete when done)",rm -rf "$(PROFILE_DIR)"; echo "raw profiles deleted after the summary")
else
NODE_PROFILE =
BUN_PROFILE =
BUN_TEST_PROFILED = $(BUN) test
profile_begin =
profile_summary = :
endif
