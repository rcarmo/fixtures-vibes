# Terminal addon teardown

Gi's Classic build adaptation disposes every successfully loaded xterm addon in reverse activation order before disposing the terminal core. Addon names remain available for diagnostics; the separate disposable list is drained once. Failed activation is not retained, and an individual disposal error cannot prevent the remaining addons or core from being cleaned up.

Some addons schedule viewport/render work during disposal. Leaving them in xterm's addon manager until after core teardown can queue a callback that reads an absent renderer's `dimensions`. The anchored adaptation covers ligatures/image and other loaded addons, not only the renderer and fit addons. It does not edit the frozen Piclaw or xterm vendor trees, change PTY ownership/handoff, or suppress global browser errors.

Unit tests reproduce the unsafe order with a lifecycle fixture and check reverse order, once-only cleanup, failed activation/disposal and fail-closed source anchors. Independent Gi browser acceptance exercises repeated real dock teardown and checks page errors. Fresh remote Piclaw oracle acceptance is unavailable; no new oracle result is claimed.
