import type { QueryClient } from "@tanstack/react-query";
import { type LocalTunnel, tuneloAccountsApi } from "./tunelo-accounts-api";

/** As long as the server keeps the merged list (10 seconds). */
const STALE_MS = 10_000;

export const localTunnelsKey = (port: number) =>
	["api-client", "local-tunnels", port] as const;

/**
 * The user's tunnels of `port`, cached like the server's list: the router
 * reads it per send, the URL bar's badge shows what it found.
 */
export function readLocalTunnels(
	queryClient: QueryClient,
	port: number,
	refresh: boolean,
): Promise<LocalTunnel[]> {
	return queryClient.fetchQuery({
		queryKey: localTunnelsKey(port),
		queryFn: () => tuneloAccountsApi.listTunnels(port, refresh),
		staleTime: refresh ? 0 : STALE_MS,
	});
}
