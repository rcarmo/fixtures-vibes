// Own fetch lifetime explicitly: old documents must not continue state reads
// during page replacement. A BFCache restore starts a new request lifetime.
export function pageRequestLifetime(target: Pick<Window, 'addEventListener'>) {
    let controller = new AbortController();
    target.addEventListener('pagehide', () => controller.abort());
    target.addEventListener('pageshow', () => {
        if (controller.signal.aborted) controller = new AbortController();
    });
    return (signal?: AbortSignal | null): AbortSignal => signal
        ? AbortSignal.any([controller.signal, signal]) : controller.signal;
}
