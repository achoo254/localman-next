import { useEffect, useSyncExternalStore } from "react";
import { ApiError } from "../../lib/api-client";
import { type CurrentUser, fetchCurrentUser } from "./current-user";

export type CurrentUserState =
	| { status: "loading" }
	| { status: "authenticated"; user: CurrentUser }
	| { status: "anonymous" }
	| { status: "error"; error: unknown };

/**
 * One `/users/me` request per page load, shared by every component. The
 * session only changes through full-page redirects (login, logout), so the
 * cached answer stays valid until `reloadCurrentUser()`.
 */
let state: CurrentUserState = { status: "loading" };
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: CurrentUserState): void {
	state = next;
	for (const listener of listeners) listener();
}

function load(): Promise<void> {
	request ??= fetchCurrentUser().then(
		// The redirect-loop counter is deliberately left alone here: a loop can
		// pass through a successful /users/me (another API keeps answering 401),
		// so only its 60-second window or a manual retry clears it.
		(user) => setState({ status: "authenticated", user }),
		(error: unknown) =>
			setState(
				error instanceof ApiError && error.status === 401
					? { status: "anonymous" }
					: { status: "error", error },
			),
	);
	return request;
}

/** Drops the cached answer and asks the server again. */
export function reloadCurrentUser(): Promise<void> {
	request = null;
	setState({ status: "loading" });
	return load();
}

/** Forgets the cached answer without fetching (test isolation). */
export function resetCurrentUserCache(): void {
	request = null;
	state = { status: "loading" };
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

const getSnapshot = (): CurrentUserState => state;

/**
 * The session as known right now, without subscribing or asking the
 * server: for event handlers of components that must not start the
 * session probe themselves (the footer's language switcher).
 */
export function peekCurrentUser(): CurrentUserState {
	return state;
}

/**
 * The session as it becomes known, without starting the probe: for code
 * present on every page (the language provider) that must not add a
 * `/users/me` request where no component asked for the session.
 */
export function useKnownCurrentUser(): CurrentUserState {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The prerendered page and its hydration never know the session. */
const LOADING: CurrentUserState = { status: "loading" };
const getServerSnapshot = (): CurrentUserState => LOADING;

export function useCurrentUser(): CurrentUserState {
	const snapshot = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);
	useEffect(() => {
		void load();
	}, []);
	return snapshot;
}
