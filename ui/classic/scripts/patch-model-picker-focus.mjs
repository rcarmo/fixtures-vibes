// Preserve the native picker; defer its initial focus until the opening key
// has finished dispatching. Cancel scheduled work on unmount.
export function patchModelPickerFocus(source) {
 const from='    useEffect(() => {\n        searchRef.current?.focus();\n    }, []);';
 if(source.indexOf(from)<0||source.indexOf(from)!==source.lastIndexOf(from))throw Error('Model picker focus anchor changed');
 const header='            <div class="compose-model-catalogue-header">';
 if(source.indexOf(header)<0||source.indexOf(header)!==source.lastIndexOf(header))throw Error('Model picker close anchor changed');
 return source.replace(header,`            <button type="button" class="compose-model-picker-close" aria-label="Close model picker" style="min-width:44px;min-height:44px;align-self:flex-end" onClick=\${onClose}>×</button>\n${header}`).replace(from,`    useEffect(() => {
        const frame = requestAnimationFrame(() => searchRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, []);`);
}
