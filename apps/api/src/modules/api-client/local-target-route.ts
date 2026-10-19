import { OperationError } from "@localman/operations";
import { localTargetKey, rewriteToTunnel } from "@localman/shared/api-client";
import { tunnelsOfPort } from "../tunelo/tunnels-of-port.js";
import { readClientSettings } from "./client-settings-service.js";

/** Where the proxy sends a request: its own URL, or a tunnel of the user. */
export interface LocalRoute {
	readonly url: string;
	/** The tunnel origin used for a local target, `null` for a public one. */
	readonly tunnel: string | null;
}

/**
 * No tunnel for the target. An agent's token never reads the account's
 * own tunnels, so it is told the ways that do reach it.
 */
function noTunnel(key: string, port: number, agent: boolean): OperationError {
	const open = agent
		? `run \`tunelo http ${port}\` on a machine linked with \`tunelo link\``
		: `run \`tunelo http ${port}\` (after \`tunelo login\`, or on a machine linked with \`tunelo link\`)`;
	return new OperationError(
		403,
		"PROXY_TARGET_BLOCKED",
		`The proxy does not reach ${key} on your machine. To send there, ${open}, or save its tunnel URL for ${key} in the API client, then send again.`,
		{ reason: "address", local: key },
	);
}

function ambiguous(key: string, tunnels: readonly string[]): OperationError {
	return new OperationError(
		409,
		"PROXY_TUNNEL_AMBIGUOUS",
		`Several tunnels serve ${key}; send to one of them directly: ${tunnels.join(", ")}`,
		{ local: key, tunnels: tunnels.join(" ") },
	);
}

function tunnelUnavailable(key: string): OperationError {
	return new OperationError(
		502,
		"PROXY_TUNNEL_UNAVAILABLE",
		`Tunelo did not list the tunnels for ${key} (unavailable, or a link was revoked); try again shortly`,
		{ local: key },
	);
}

/**
 * Routes a local target (localhost, 127.x, a LAN address…) through the
 * user's tunnel, like the Send button does in the browser: the enabled
 * tunnel URL saved for that host and port first, then, for localhost, the
 * one live HTTP tunnel of that port. `sessionId` is `null` for an agent:
 * its tunnels come from linked machines only. A public target is left as is.
 */
export async function routeLocalTarget(
	sub: string,
	sessionId: string | null,
	url: string,
): Promise<LocalRoute> {
	const local = localTargetKey(url);
	if (!local) return { url, tunnel: null };
	const refused = () => noTunnel(local.key, local.port, sessionId === null);
	const through = (tunnel: string): LocalRoute => {
		const rewritten = rewriteToTunnel(url, tunnel);
		if (rewritten === null) throw refused();
		return { url: rewritten, tunnel: new URL(rewritten).origin };
	};
	const settings = await readClientSettings(sub);
	const mapping = settings.tunnelMappings.find(
		(entry) => entry.enabled && entry.key === local.key,
	);
	if (mapping) return through(mapping.url);
	// Tunelo knows a tunnel's local port, not the host it was opened on.
	if (!local.key.startsWith("localhost:")) throw refused();
	const { tunnels, failures } = await tunnelsOfPort(sub, sessionId, local.port);
	const [only] = tunnels;
	if (tunnels.length === 1 && only) return through(only.url);
	if (tunnels.length > 1) {
		throw ambiguous(
			local.key,
			tunnels.map((tunnel) => tunnel.url),
		);
	}
	// A source that did not answer may hold the tunnel: not "you have none".
	if (failures.length > 0) throw tunnelUnavailable(local.key);
	throw refused();
}
