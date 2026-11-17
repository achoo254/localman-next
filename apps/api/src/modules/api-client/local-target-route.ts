import { OperationError } from "@localman/operations";
import {
	type HeaderEntry,
	localTargetKey,
	rewriteToTunnel,
} from "@localman/shared/api-client";
import { machineRoute } from "../tunelo/machine-targets.js";
import type { LocalTunnel } from "../tunelo/tunelo-view.js";
import { tunnelsOfPort } from "../tunelo/tunnels-of-port.js";
import { readClientSettings } from "./client-settings-service.js";

/** Where the proxy sends a request: its own URL, or a tunnel of the user. */
export interface LocalRoute {
	readonly url: string;
	/** The tunnel origin used for a local target, `null` for a public one. */
	readonly tunnel: string | null;
	/** Headers the server adds (a machine's link token and port). */
	readonly headers?: readonly HeaderEntry[];
	/** Id of the user's machine whose localhost the request goes to. */
	readonly machine?: string;
	/** That machine's link token (to confirm a refusal with Tunelo). */
	readonly machineToken?: string;
}

/**
 * No tunnel for the target. An agent's token never reads the account's
 * own tunnels, so it is told the ways that do reach it.
 */
function noTunnel(key: string, port: number, agent: boolean): OperationError {
	const open = agent
		? `run \`tunelo http ${port}\` on a machine signed in with \`tunelo login\` on this account`
		: `run \`tunelo http ${port}\` after \`tunelo login\` on this account`;
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

function machinesAmbiguous(
	key: string,
	machines: readonly LocalTunnel[],
): OperationError {
	const list = machines.map((m) => `${m.deviceName} (${m.linkId})`);
	return new OperationError(
		409,
		"PROXY_MACHINE_AMBIGUOUS",
		`Several of your machines can serve ${key}; pick one with \`machine\`: ${list.join(", ")}`,
		{ local: key, machines: machines.map((m) => m.linkId).join(" ") },
	);
}

function notLoopback(key: string): OperationError {
	return new OperationError(
		400,
		"PROXY_MACHINE_TARGET",
		`A machine is reached on its localhost only, not ${key}`,
		{ local: key },
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
 * one live HTTP tunnel of that port, then the user's one own machine
 * (`tunelo login`), whose localhost gets the request. `machine` names that
 * machine outright. `sessionId` is `null` for an agent: its tunnels come
 * from linked machines only. A public target is left as is.
 */
export async function routeLocalTarget(
	sub: string,
	sessionId: string | null,
	url: string,
	machine?: string,
): Promise<LocalRoute> {
	const local = localTargetKey(url);
	if (!local) {
		if (machine !== undefined) throw notLoopback(new URL(url).host);
		return { url, tunnel: null };
	}
	const toMachine = (id: string): Promise<LocalRoute> => {
		if (!local.key.startsWith("localhost:")) throw notLoopback(local.key);
		return machineRoute(sub, id, new URL(url), local.port);
	};
	if (machine !== undefined) return toMachine(machine);
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
	const listed = await tunnelsOfPort(sub, sessionId, local.port);
	const { failures } = listed;
	// A tunnel the user opened for the port wins over a machine's localhost.
	const tunnels = listed.tunnels.filter((t) => t.source !== "machine");
	const machines = listed.tunnels.filter((t) => t.source === "machine");
	const [only] = tunnels;
	if (tunnels.length === 1 && only) return through(only.url);
	if (tunnels.length > 1) {
		throw ambiguous(
			local.key,
			tunnels.map((tunnel) => tunnel.url),
		);
	}
	const [ownMachine] = machines;
	if (machines.length === 1 && ownMachine?.linkId) {
		return toMachine(ownMachine.linkId);
	}
	if (machines.length > 1) throw machinesAmbiguous(local.key, machines);
	// A source that did not answer may hold the tunnel: not "you have none".
	if (failures.length > 0) throw tunnelUnavailable(local.key);
	throw refused();
}
