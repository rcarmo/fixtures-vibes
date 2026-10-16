import {
  modelContextBlocked,
  F_,
  X_,
  R_,
  Y_,
  pe,
  subscribeModelSettlement,
  getAgentModels2,
  selectAgentThinking2,
  selectAgentModel2
} from "./app-jg5zqy92.js";

// src/gi-settings-models.ts
function defaultThinkingLabel(data) {
  return data?.default_thinking_level ? `Default (${data.default_thinking_level})` : "Default";
}
function Models({ chatJid, filter = "", onMutationStart, onMutationEnd, onApplied }) {
  const [data, setData] = F_(null);
  const [chosen, setChosen] = F_("");
  const [thinking, setThinking] = F_("");
  const thinkingDirty = Y_(false);
  const [error, setError] = F_("");
  const [notice, setNotice] = F_("");
  const [busy, setBusy] = F_(false);
  const [attempt, setAttempt] = F_(0);
  const [reading, setReading] = F_(true);
  const [readError, setReadError] = F_("");
  const generation = Y_(0);
  const readPending = Y_(true);
  const dirty = Y_(false);
  const mounted = Y_(false);
  const saving = Y_(false);
  const previousFilter = Y_(filter);
  R_(() => {
    mounted.current = true;
    const unsubscribe = subscribeModelSettlement(chatJid, () => {
      generation.current++;
      readPending.current = true;
      setReading(true);
      setAttempt((value) => value + 1);
    });
    return () => {
      mounted.current = false;
      generation.current++;
      unsubscribe();
    };
  }, [chatJid]);
  R_(() => {
    if (previousFilter.current !== filter) {
      previousFilter.current = filter;
      dirty.current = true;
      setChosen("");
      setNotice("");
    }
  }, [filter]);
  X_(() => {
    if (saving.current)
      return;
    const request = ++generation.current;
    readPending.current = true;
    setReading(true);
    setReadError("");
    getAgentModels2(chatJid).then((snapshot) => {
      if (mounted.current && request === generation.current) {
        setData(snapshot);
        if (!dirty.current)
          setChosen(snapshot.current);
        if (!thinkingDirty.current)
          setThinking(snapshot.thinking_level || "");
        readPending.current = false;
        setReading(false);
      }
    }).catch((error) => {
      if (mounted.current && request === generation.current) {
        setReadError(error.message);
        setReading(false);
      }
    });
    return () => {
      if (request === generation.current)
        generation.current++;
    };
  }, [chatJid, attempt, busy]);
  function refresh() {
    generation.current++;
    readPending.current = true;
    setReading(true);
    setAttempt((value) => value + 1);
  }
  const options = data?.model_options || data?.models || [];
  const query = filter.trim().toLowerCase();
  const matching = options.filter((option) => `${option.label || option.id} ${option.provider || ""}`.toLowerCase().includes(query));
  const selected = options.find((option) => (option.label || option.id) === chosen);
  const blocked = modelContextBlocked({ contextWindow: selected?.context_window ?? selected?.contextWindow }, data?.context_usage);
  async function apply() {
    if (saving.current || readPending.current || !data || !selected || blocked || chosen === data.current)
      return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const token = onMutationStart();
    try {
      const result = await selectAgentModel2(chatJid, chosen);
      if (mounted.current) {
        dirty.current = false;
        thinkingDirty.current = false;
        setChosen(result.current);
        setThinking(result.thinking_level || "");
        setNotice("Model applied to this session.");
        onApplied(result, token);
      }
    } catch (error) {
      if (mounted.current)
        setError(error.message);
    } finally {
      onMutationEnd(token);
      saving.current = false;
      if (mounted.current)
        setBusy(false);
    }
  }
  async function applyThinking() {
    if (saving.current || readPending.current || !data?.thinking_configurable || chosen !== data.current || thinking === (data.thinking_level || "") || thinking && !data.thinking_levels?.includes(thinking))
      return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const token = onMutationStart();
    try {
      const result = await selectAgentThinking2(chatJid, data.current, thinking, data.thinking_token);
      if (mounted.current) {
        thinkingDirty.current = false;
        setThinking(result.thinking_level || "");
        setNotice("Thinking applied to future turns in this session.");
        onApplied(result, token);
      }
    } catch (error) {
      if (mounted.current)
        setError(error.message);
    } finally {
      onMutationEnd(token);
      saving.current = false;
      if (mounted.current)
        setBusy(false);
    }
  }
  return pe`<section aria-labelledby="gi-models-title">
        <h2 id="gi-models-title">Models</h2>
        <p>Session settings · <code>${chatJid}</code></p>
        <p>Changes affect this session only. Instance defaults and other sessions are unchanged.</p>
        ${reading && pe`<p role="status">${data ? "Refreshing models…" : "Loading models…"}</p>`}
        ${readError && pe`<div role="alert">${readError} <button disabled=${busy || reading} onClick=${refresh}>Retry</button></div>`}
        ${error && pe`<div role="alert">${error}</div>`}
        <button disabled=${busy || reading} onClick=${refresh}>Refresh models</button>
        ${data && pe`
            <dl class="gi-settings-values">${(!query || String(data.current || "").toLowerCase().includes(query)) && pe`<dt>Current model</dt><dd data-testid="settings-current-model">${data.current}</dd>`}
            ${data.supports_thinking && pe`<dt>Thinking</dt><dd>${data.thinking_level || defaultThinkingLabel(data)}</dd>`}
            <dt>Context capacity</dt><dd data-testid="settings-context-capacity">${Number.isFinite(data.context_window) && data.context_window > 0 ? data.context_window : "Unknown"}</dd></dl>
            <label>Session model<select aria-label="Session model" size=${Math.max(2, Math.min(8, Math.min(matching.length, 50) + 1))} value=${chosen} disabled=${busy} onChange=${(e) => {
    dirty.current = true;
    setChosen(e.target.value);
    setNotice("");
  }}>
                <option value="" disabled>Choose a model</option>
                ${matching.slice(0, 50).map((option) => pe`<option value=${option.label || option.id}>${option.label || option.id}</option>`)}
            </select></label>
            ${matching.length > 50 && pe`<p>Showing 50 of ${matching.length} models. Refine the filter.</p>`}
            ${matching.length === 0 && pe`<p>No matching models.</p>`}
            ${blocked && pe`<p role="status">This model cannot fit the measured context. Compact the session before changing models.</p>`}
            <button disabled=${busy || reading || !!readError || !selected || blocked || chosen === data.current} onClick=${apply}>${busy ? "Applying…" : "Apply model"}</button>
            ${data.thinking_configurable && pe`<label>Thinking for current model<select aria-label="Session thinking level" value=${thinking} disabled=${busy || reading || !!readError || chosen !== data.current} onChange=${(e) => {
    thinkingDirty.current = true;
    setThinking(e.target.value);
    setNotice("");
  }}>
                <option value="">${defaultThinkingLabel(data)}</option>
                ${(data.thinking_levels || []).map((level) => pe`<option value=${level}>${level}</option>`)}
            </select></label>
            <button disabled=${busy || reading || !!readError || chosen !== data.current || thinking === (data.thinking_level || "") || !!thinking && !data.thinking_levels?.includes(thinking)} onClick=${applyThinking}>Apply thinking</button>`}
            ${notice && pe`<p role="status">${notice}</p>`}
        `}
    </section>`;
}
export {
  Models
};
