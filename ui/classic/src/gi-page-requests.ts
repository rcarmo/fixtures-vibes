// Own fetch lifetime explicitly: old documents must not continue state reads
// during page replacement. A BFCache restore starts a new request lifetime.
export function pageRequestLifetime(target: Pick<Window, 'addEventListener'>) {
    let controller = new AbortController();
    // WebKit can reject outstanding fetches as access-control errors before
    // pagehide runs. Cancel while the document is still allowed to use them.
    target.addEventListener('beforeunload', () => controller.abort());
    target.addEventListener('pagehide', () => controller.abort());
    target.addEventListener('pageshow', () => {
        if (controller.signal.aborted) controller = new AbortController();
    });
    return (signal?: AbortSignal | null): AbortSignal => signal
        ? AbortSignal.any([controller.signal, signal]) : controller.signal;
}
