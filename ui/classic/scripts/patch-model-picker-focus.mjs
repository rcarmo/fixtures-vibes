// Preserve the native picker; defer its initial focus until the opening key
// has finished dispatching. Cancel scheduled work on unmount.
export function patchModelPickerFocus(source) {
 const from='    useEffect(() => {\n        searchRef.current?.focus();\n    }, []);';
 if(source.indexOf(from)<0||source.indexOf(from)!==source.lastIndexOf(from))throw Error('Model picker focus anchor changed');
 const header='            <div class="compose-model-catalogue-header">';
 if(source.indexOf(header)<0||source.indexOf(header)!==source.lastIndexOf(header))throw Error('Model picker close anchor changed');
 const once=(text,from,to)=>{if(text.indexOf(from)<0||text.indexOf(from)!==text.lastIndexOf(from))throw Error('Model picker contract anchor changed');return text.replace(from,to);};
 source=once(source,"() => projection.renderedEntries.filter((entry) => entry.contextFit.state !== 'blocked'),\n        [projection],", "() => loading || switching ? [] : projection.renderedEntries.filter((entry) => entry.contextFit.state !== 'blocked'),\n        [projection, loading, switching],");
 source=once(source,'aria-activedescendant=${activeKey ? optionId(instanceIdRef.current, activeKey) : undefined}', 'aria-activedescendant=${!loading && !switching && selectableEntries.some(entry => entry.key === activeKey) ? optionId(instanceIdRef.current, activeKey) : undefined}');
 source=once(source,"        const blocked = entry.contextFit.state === 'blocked';", "        const blocked = switching || entry.contextFit.state === 'blocked';");
 source=once(source,'aria-expanded="true"\n                        aria-controls=', 'aria-expanded="true"\n                        aria-haspopup="listbox"\n                        aria-controls=');
 source=once(source,'role="listbox" aria-label="Models">','role="listbox" aria-label="Models" aria-busy=${loading || switching ? "true" : "false"}>');
 source=once(source,'${projection.sections.map((section)', '${(loading ? [] : projection.sections).map((section)');
 source=once(source,'onClick=${() => setQuery(\'\')}', 'onClick=${() => { setQuery(\'\'); searchRef.current?.focus(); }}');
 return source.replace(header,`            <button type="button" class="compose-model-picker-close" aria-label="Close model picker" style="min-width:44px;min-height:44px;align-self:flex-end" onClick=\${onClose}>×</button>\n${header}`).replace(from,`    useEffect(() => {
        const frame = requestAnimationFrame(() => searchRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, []);`);
}
