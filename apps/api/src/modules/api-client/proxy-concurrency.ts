import { OperationError } from "@localman/operations";
import { messagesFor } from "../../i18n/server-messages.js";
import { readUserLocale } from "../users/user-locale.js";

/** Proxied requests allowed in flight at once. */
export interface ProxyConcurrencyLimits {
	/** Per account: a few tabs sending at once. */
	readonly perUser: number;
	/** Whole process: it also serves the dashboard and every mock API. */
	readonly total: number;
}

/**
 * Each request may hold up to 10 MB of body plus its JSON encoding for up
 * to 120 s, so these caps bound the proxy's memory to a few hundred MB.
 */
export const PROXY_CONCURRENCY: ProxyConcurrencyLimits = {
	perUser: 4,
	total: 32,
};

/** Which cap refused a request. */
export type ProxyBusyScope = "user" | "server";

export type ProxySlot =
	| { readonly ok: true; readonly release: () => void }
	| { readonly ok: false; readonly scope: ProxyBusyScope };

export interface ProxyConcurrency {
	readonly limits: ProxyConcurrencyLimits;
	/** Takes a slot of `sub`; `release` is idempotent. */
	acquire(sub: string): ProxySlot;
}

/** In-memory slots of this process (the API runs as one process). */
export function createProxyConcurrency(
	limits: ProxyConcurrencyLimits = PROXY_CONCURRENCY,
): ProxyConcurrency {
	const perUser = new Map<string, number>();
	let total = 0;
	return {
		limits,
		acquire(sub) {
			const mine = perUser.get(sub) ?? 0;
			if (mine >= limits.perUser) return { ok: false, scope: "user" };
			if (total >= limits.total) return { ok: false, scope: "server" };
			perUser.set(sub, mine + 1);
			total++;
			let released = false;
			return {
				ok: true,
				release: () => {
					if (released) return;
					released = true;
					total--;
					const left = (perUser.get(sub) ?? 1) - 1;
					if (left > 0) perUser.set(sub, left);
					else perUser.delete(sub);
				},
			};
		},
	};
}

/** 429 `PROXY_BUSY` in the user's language; `details.scope` says which cap. */
export async function proxyBusy(
	sub: string,
	scope: ProxyBusyScope,
	limits: ProxyConcurrencyLimits,
): Promise<OperationError> {
	const texts = messagesFor(await readUserLocale(sub)).apiClient;
	const message =
		scope === "user"
			? texts.proxyBusyUser({ max: limits.perUser })
			: texts.proxyBusyServer;
	const max = scope === "user" ? limits.perUser : limits.total;
	return new OperationError(429, "PROXY_BUSY", message, { scope, max });
}
