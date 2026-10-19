import { tuneloRuntimeOrNull } from "./tunelo-runtime.js";
import type { LocalTunnelList } from "./tunelo-view.js";
import { linkedOnlyKey } from "./tunnel-list-cache.js";
import { fetchAll, listLocalTunnels } from "./tunnel-list-service.js";

/**
 * The user's live HTTP tunnels of one local port, for the server's proxy
 * (a TCP tunnel cannot carry an HTTP request), with the sources that did
 * not answer. With a browser session this is `listLocalTunnels`; without
 * one (an agent's token) only linked machines answer, since the account's
 * own tunnels need the session's IdP token. Empty while Tunelo is off
 * (`TUNELO_ACCOUNTS_ENABLED`), so saved tunnel URLs are all that is left.
 */
export async function tunnelsOfPort(
	userSub: string,
	sessionId: string | null,
	port: number,
): Promise<LocalTunnelList> {
	const runtime = tuneloRuntimeOrNull();
	if (!runtime) return { tunnels: [], failures: [] };
	let list: LocalTunnelList;
	if (sessionId !== null) {
		list = await listLocalTunnels(userSub, sessionId, { port });
	} else {
		const key = linkedOnlyKey(userSub);
		list =
			runtime.cache.get(key) ??
			(await runtime.cache.load(key, () => fetchAll(runtime, userSub, null)));
	}
	return {
		tunnels: list.tunnels.filter(
			(tunnel) => tunnel.localPort === port && tunnel.protocol === "http",
		),
		failures: list.failures,
	};
}
