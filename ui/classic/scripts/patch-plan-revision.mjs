// Anchored adaptation of the immutable Plan sidebar 0.1.25. The caller verifies its source hash.
const once = (source, from, to) => {
  const at = source.indexOf(from);
  if (at < 0 || source.indexOf(from, at + from.length) >= 0) throw Error(`Plan revision anchor changed: ${from.slice(0, 90)}`);
  return source.replace(from, to);
};
const section = (source, start, end, replacement) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < a || source.indexOf(start, a + start.length) >= 0) throw Error(`Plan revision section changed: ${start}`);
  return source.slice(0, a) + replacement + source.slice(b);
};
export function patchPlanRevision(source) {
  if (source.includes('function acceptWritePlan(')) throw Error('Plan revision anchor changed: adaptation already applied');
  let s = 'import { validRevision, requireRevision, isRevisionConflict } from "../../src/gi-revision-state.ts";\n' + source;
  s = once(s, '    updatedAt: null,', '    updatedAt: null,\n    revision: null,\n    baseline: "",');
  s = once(s, '  injectStyles();', '  const drafts = new Map();\n\n  injectStyles();');
  s = once(s, '    saveButton.disabled = state.loading || !state.dirty;', '    saveButton.disabled = state.loading || !state.dirty || !validRevision(state.revision);\n    saveButton.title = validRevision(state.revision) ? "Save" : "Revision-safe persistence unavailable — read-only saves";');
  s = once(s, '    resetButton.disabled = state.loading;', '    resetButton.disabled = state.loading || !validRevision(state.revision);\n    submitButton.disabled = state.loading || !validRevision(state.revision);');
  s = once(s, '    setOpen(false);', '    if (state.dirty || state.loading) return;\n    setOpen(false);');
  s = once(s, '      state.updatedAt = plan.updated_at || null;\n      setEditorValue(plan.markdown || "");', '      state.revision = typeof plan?.markdown === "string" && validRevision(plan.revision) ? plan.revision : null;\n      state.baseline = plan.markdown || "";\n      state.updatedAt = plan.updated_at || null;\n      setEditorValue(plan.markdown || "");');
  s = once(s, '        : state.updatedAt ? `Loaded ${loadedAt}` : "Loaded default plan");', '        : state.updatedAt ? `Loaded ${loadedAt}` : "Loaded default plan");\n      if (!validRevision(state.revision)) setStatus("Revision-safe persistence unavailable — read-only saves", "error");');
  s = section(s, '  async function resetPlan() {', '  function buildPlanSubmissionPrompt(markdown) {', `  function acceptWritePlan(plan) {
    if (typeof plan?.markdown !== "string" || !validRevision(plan.revision)) {
      state.revision = null;
      throw new Error("Plan acknowledgement omitted its revision or content; refresh and review before saving again");
    }
    state.revision = plan.revision;
    state.baseline = plan.markdown;
    state.updatedAt = plan.updated_at || null;
  }

  function persistenceError(error) {
    setStatus(isRevisionConflict(error) ? "Plan conflict: saved revision changed; draft preserved. Refresh to review (asks before discarding)." : String(error?.message || error), "error");
  }

  async function resetPlan() {
    if (state.loading) return null;
    const expected_revision = requireRevision(state.revision);
    if (!confirm("Reset this chat plan to the default checklist? Unsaved changes will be discarded.")) return null;
    const request = beginRequest();
    try {
      const payload = await apiJson(planUrl(request.chatJid), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_jid: request.chatJid, action: "reset", expected_revision }),
      });
      if (!isCurrentRequest(request)) return null;
      const plan = payload.plan || payload;
      acceptWritePlan(plan);
      if (canApplyPlanResponse(state, request)) {
        setEditorValue(plan.markdown);
        markDirty(false);
        setStatus('Reset ' + formatTime(state.updatedAt), "ok");
      } else {
        markDirty(true);
        setStatus("Reset completed; newer edits are unsaved.", "warning");
      }
      return plan;
    } catch (error) {
      if (isCurrentRequest(request)) persistenceError(error);
      throw error;
    } finally {
      finishRequest(request);
    }
  }

  async function savePlan({ drainPending = true } = {}) {
    if (state.loading) return null;
    const expected_revision = requireRevision(state.revision);
    const markdown = getEditorValue();
    const request = beginRequest();
    try {
      const payload = await apiJson(planUrl(request.chatJid), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_jid: request.chatJid, markdown, expected_revision }),
      });
      if (!isCurrentRequest(request)) return null;
      const plan = payload.plan || payload;
      acceptWritePlan(plan);
      if (canApplyPlanResponse(state, request)) {
        setEditorValue(plan.markdown);
        markDirty(false);
        setStatus('Saved ' + formatTime(state.updatedAt), "ok");
      } else {
        markDirty(true);
        setStatus("Saved previous edits; newer changes are unsaved.", "warning");
      }
      return plan;
    } catch (error) {
      if (isCurrentRequest(request)) persistenceError(error);
      throw error;
    } finally {
      finishRequest(request, { drainPending });
    }
  }

`);
  s = once(s, '    const chatJid = state.chatJid;\n    let plan;', '    if (state.loading) return;\n    const chatJid = state.chatJid;\n    const editRevision = state.editRevision;\n    let plan;');
  s = once(s, '    const markdown = plan.markdown || "";', '    if (editRevision !== state.editRevision || state.dirty) {\n      drainPendingRemoteRefresh();\n      setStatus("Newer edits are unsaved; save again before submitting.", "warning");\n      return;\n    }\n    const markdown = plan.markdown || "";');
  s = once(s, '    invalidatePlanRequests(state);\n    state.chatJid = next;', '    drafts.set(state.chatJid, { markdown: getEditorValue(), revision: state.revision, baseline: state.baseline, updatedAt: state.updatedAt, dirty: state.dirty });\n    invalidatePlanRequests(state);\n    state.chatJid = next;');
  s = once(s, '    clearDisplayedPlan();\n    renderChrome();', '    clearDisplayedPlan();\n    state.revision = null;\n    state.baseline = "";\n    const draft = drafts.get(next);\n    if (draft) {\n      state.revision = draft.revision; state.baseline = draft.baseline; state.updatedAt = draft.updatedAt;\n      setEditorValue(draft.markdown); state.dirty = draft.dirty;\n    }\n    setStatus(state.dirty ? "Restored unsaved plan draft" : "Loading plan…");\n    renderChrome();');
  s = once(s, '  refreshButton.addEventListener("click", () => loadPlan());', '  refreshButton.addEventListener("click", () => {\n    if (state.dirty && !confirm("Refresh and discard unsaved plan changes?")) return;\n    void loadPlan();\n  });');
  return s;
}
