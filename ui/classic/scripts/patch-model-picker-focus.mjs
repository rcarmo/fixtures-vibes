// Preserve the native picker; defer its initial focus until the opening key
// has finished dispatching. Cancel scheduled work on unmount.
export function patchModelPickerFocus(source) {
 const from='    useEffect(() => {\n        searchRef.current?.focus();\n    }, []);';
 if(source.indexOf(from)<0||source.indexOf(from)!==source.lastIndexOf(from))throw Error('Model picker focus anchor changed');
 return source.replace(from,`    useEffect(() => {
        const frame = requestAnimationFrame(() => searchRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, []);`);
}
