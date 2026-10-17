// Preserve the native picker; defer its initial focus until the opening key
// has finished dispatching. Cancel scheduled work on unmount.
export function patchModelPickerFocus(source) {
 const from='    useEffect(() => {\n        searchRef.current?.focus();\n    }, []);';
 if(source.indexOf(from)<0||source.indexOf(from)!==source.lastIndexOf(from))throw Error('Model picker focus anchor changed');
 const header='            <div class="compose-model-catalogue-header">';
 if(source.indexOf(header)<0||source.indexOf(header)!==source.lastIndexOf(header))throw Error('Model picker close anchor changed');
 const once=(text,from,to)=>{if(text.indexOf(from)<0||text.indexOf(from)!==text.lastIndexOf(from))throw Error('Model picker contract anchor changed');return text.replace(from,to);};
 source=once(source,'    entries,\n', '    entries,\n    instanceKey,\n    supportsThinking = false,\n');
 source=once(source,"${thinkingLevels.length > 0 && html`", "${(supportsThinking || thinkingLevels.length > 0) && html`");
 source=once(source,'disabled=${switching || typeof onSelectThinking !== \'function\'}', 'disabled=${switching || typeof onSelectThinking !== \'function\' || !thinkingLevels.length}');
 source=once(source,'if (instanceIdRef.current == null) instanceIdRef.current = ++modelPickerInstanceCounter;', 'if (instanceIdRef.current == null) instanceIdRef.current = instanceKey || ++modelPickerInstanceCounter;');
 source=once(source,'                aria-disabled=${blocked', '                disabled=${switching}\n                aria-disabled=${blocked');
 source=once(source,"() => projection.renderedEntries.filter((entry) => entry.contextFit.state !== 'blocked'),\n        [projection],", "() => loading || switching ? [] : projection.renderedEntries.filter((entry) => entry.contextFit.state !== 'blocked'),\n        [projection, loading, switching],");
 source=once(source,'aria-activedescendant=${activeKey ? optionId(instanceIdRef.current, activeKey) : undefined}', 'aria-activedescendant=${!loading && !switching && selectableEntries.some(entry => entry.key === activeKey) ? optionId(instanceIdRef.current, activeKey) : undefined}');
 source=once(source,"        const blocked = entry.contextFit.state === 'blocked';", "        const blocked = switching || entry.contextFit.state === 'blocked';");
 source=once(source,'aria-expanded="true"\n                        aria-controls=', 'aria-expanded="true"\n                        aria-haspopup="listbox"\n                        aria-controls=');
 source=once(source,'role="listbox" aria-label="Models">','role="listbox" aria-label="Models" tabindex="-1" aria-busy=${loading || switching ? "true" : "false"}>');
 source=once(source,'${projection.sections.map((section)', '${(loading ? [] : projection.sections).map((section)');
 source=once(source,"if (!entry || switching || entry.contextFit.state === 'blocked') return;", "if (!entry || loading || switching || entry.contextFit.state === 'blocked') return;");
 source=once(source,'}, [onSelect, switching]);', '}, [onSelect, loading, switching]);');
 source=once(source,'        const actions = {', '        if ((loading || switching) && event.key !== "Escape" && event.key !== "Tab") { event.preventDefault(); return; }\n        const actions = {');
 source=once(source,'}, [activeKey, choose, onClose, onTogglePin, projection.renderedEntries]);', '}, [activeKey, choose, onClose, onTogglePin, projection.renderedEntries, loading, switching]);');
 source=once(source,'onClick=${() => setQuery(\'\')}', 'onClick=${() => { setQuery(\'\'); searchRef.current?.focus(); }}');
 return source.replace(header,`            <button type="button" class="compose-model-picker-close" aria-label="Close model picker" style="min-width:44px;min-height:44px;align-self:flex-end" onClick=\${onClose}>×</button>\n${header}`).replace(from,`    useEffect(() => {
        const frame = requestAnimationFrame(() => searchRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, []);`);
}
