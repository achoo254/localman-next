/**
 * Stops automatic redirects to `/auth/login` from looping (e.g. when the
 * browser drops the session cookie right after a successful sign-in). Only
 * a counter and a timestamp are stored, never anything about the session.
 */

const STORAGE_KEY = "localman-login-redirects";
const WINDOW_MS = 60_000;
/** Automatic redirects allowed per window; the next one is refused. */
const MAX_REDIRECTS = 2;

interface RedirectRecord {
	count: number;
	since: number;
}

function read(): RedirectRecord | null {
	try {
		const raw = window.sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const value: unknown = JSON.parse(raw);
		if (
			typeof value === "object" &&
			value !== null &&
			"count" in value &&
			"since" in value &&
			typeof value.count === "number" &&
			typeof value.since === "number"
		) {
			return { count: value.count, since: value.since };
		}
	} catch {
		// Unreadable or corrupt: treat as no previous redirects.
	}
	return null;
}

function write(record: RedirectRecord): void {
	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
	} catch {
		// Storage disabled (private mode, quota): the guard cannot persist, so
		// it degrades to the plain redirect behaviour.
	}
}

/**
 * Records an automatic login redirect and says whether it may happen.
 * Returns false once more than MAX_REDIRECTS happen within WINDOW_MS.
 */
export function allowAutoLoginRedirect(now: number = Date.now()): boolean {
	const previous = read();
	const current =
		previous && now - previous.since < WINDOW_MS && now >= previous.since
			? previous
			: { count: 0, since: now };
	if (current.count >= MAX_REDIRECTS) return false;
	write({ count: current.count + 1, since: current.since });
	return true;
}

/**
 * Clears the counter. Only for an explicit user retry: a successful session
 * probe is not proof the loop is over, so it must not call this.
 */
export function resetAutoLoginRedirects(): void {
	try {
		window.sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing stored if storage is unavailable.
	}
}
