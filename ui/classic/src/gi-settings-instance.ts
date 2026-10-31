import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { getGeneralSettings, saveGeneralSettings } from './api.js';
import { NumberStepper } from './gi-number-stepper.js';

// Autosave the changed fields only: an upload edit cannot reset the turn limit.
export function InstanceConfig() {
    const [settings, setSettings] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [applied, setApplied] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const saved = useRef<any>(null);
    const alive = useRef(false);
    const noticeTimer = useRef<any>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(noticeTimer.current); }; }, []);
    useEffect(() => {
        let live = true;
        setError('');
        getGeneralSettings().then(({ status, data }) => {
            if (status !== 200 || !data?.ok || !Number.isInteger(data.settings?.workspaceUploadLimitMb)) throw Error('Invalid general settings response');
            if (live) { saved.current = data.settings; setSettings(data.settings); }
        }).catch(() => live && setError('Failed to load instance settings.'));
        return () => { live = false; };
    }, [attempt]);
    useEffect(() => {
        if (!settings || busy) return;
        const patch = Object.fromEntries(Object.entries(settings).filter(([key, value]) => value !== saved.current?.[key]));
        if (!Object.keys(patch).length) return;
        const timer = setTimeout(async () => {
            setBusy(true); setApplied(false);
            try {
                const { status, data } = await saveGeneralSettings(patch);
                if (!alive.current) return;
                if (status < 200 || status >= 300 || !data?.ok) throw Error(data?.error || `Failed to save general settings (${status})`);
                saved.current = { ...saved.current, ...patch };
                setError(''); setApplied(true);
                clearTimeout(noticeTimer.current);
                noticeTimer.current = setTimeout(() => alive.current && setApplied(false), 4000);
            } catch (err) {
                if (alive.current) { setError(`Failed to save: ${err?.message || err}`); setSettings({ ...saved.current }); }
            } finally { if (alive.current) setBusy(false); }
        }, 800);
        return () => clearTimeout(timer);
    }, [settings, busy]);
    const change = (key, value) => {
        if (!Number.isInteger(value)) { setError('Settings require whole numbers.'); return; }
        setError(''); setApplied(false); setSettings(previous => ({ ...previous, [key]: value }));
    };
    return html`<div class="gi-settings-instance">
        <h3>Instance Configuration</h3>
        ${applied && html`<div class="settings-general-applied-notice" role="status" aria-live="polite">Settings applied. Iteration changes take effect on subsequent turns; upload changes on the next upload.</div>`}
        ${error && html`<div role="alert">${error}${!settings && html`<button onClick=${() => setAttempt(n => n + 1)}>Retry</button>`}</div>`}
        ${settings && html`<div class="settings-row">
            <label for="gi-general-upload-limit">Upload limit (MB)</label>
            <${NumberStepper} id="gi-general-upload-limit" label="Upload limit (MB)" value=${settings.workspaceUploadLimitMb} min=${1} max=${1024} fallback=${256} disabled=${busy} onChange=${value => change('workspaceUploadLimitMb', value)} />
            <span class="settings-hint">Applies to workspace uploads.</span>
        </div>${Number.isInteger(settings.maxIterations) && html`<div class="settings-row">
            <label for="gi-general-max-iterations">Maximum iterations</label>
            <${NumberStepper} id="gi-general-max-iterations" label="Maximum iterations" value=${settings.maxIterations} min=${1} max=${2147483647} fallback=${128} disabled=${busy} onChange=${value => change('maxIterations', value)} />
            <span class="settings-hint">Default: 128. Model/tool loop iterations per turn. Instance-wide; applies to subsequent turns without restarting. Running turns keep their limit.</span>
        </div>`}`}
    </div>`;
}
