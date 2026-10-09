import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False while rendering on the server and while hydrating the prerendered
 * landing, true afterwards (and at once in a client-only render). Content
 * that depends on the browser (query string, clock) waits for it so the
 * hydrated markup matches the prerendered one.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
}
