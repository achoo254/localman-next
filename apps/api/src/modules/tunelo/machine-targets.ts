import { OperationError } from "@localman/operations";
import type { HeaderEntry } from "@localman/shared/api-client";
import { isValidObjectId } from "mongoose";
import { FORWARD_HEADERS, FORWARD_PATH } from "./machine-forward-contract.js";
import {
	type StoredTunnelLink,
	TunnelLinkModel,
	linkTokenSlot,
} from "./tunelo-link-model.js";
import { tuneloRuntime } from "./tunelo-runtime.js";
import type { LocalTunnel } from "./tunelo-view.js";

/** Origin of a machine's tunnel, from its forward URL. */
export function machineOrigin(forwardUrl: string): string {
	return new URL(forwardUrl).origin;
}

/** The user's own machines Localman may send to, oldest first. */
async function reachableMachines(userSub: string): Promise<StoredTunnelLink[]> {
	return TunnelLinkModel.find({
		userSub,
		source: "self",
		status: "linked",
		deadAt: null,
		forwardEnabled: { $ne: false },
		forwardUrl: { $type: "string" },
	})
		.sort({ createdAt: 1 })
		.lean<StoredTunnelLink[]>();
}

/**
 * `localhost:<port>` on each of the user's own machines, as entries of the
 * tunnel list (`source: machine`): any port may be asked for, the machine
 * answers whether something listens there.
 */
export async function machineTunnelsOf(
	userSub: string,
	port: number,
): Promise<LocalTunnel[]> {
	const rows = await reachableMachines(userSub);
	return rows.map((row) => ({
		source: "machine",
		linkId: String(row._id),
		protocol: "http",
		url: machineOrigin(row.forwardUrl ?? ""),
		localPort: port,
		publicPort: null,
		deviceName: row.machineName ?? "",
		connectedAt: (row.linkedAt ?? row.createdAt ?? new Date(0)).toISOString(),
		basicAuth: false,
	}));
}

/** A request for a machine's loopback: URL, origin and the server's headers. */
export interface MachineRoute {
	readonly url: string;
	readonly tunnel: string;
	readonly headers: HeaderEntry[];
	readonly machine: string;
	readonly machineToken: string;
}

function machineNotFound(): OperationError {
	return new OperationError(404, "MACHINE_NOT_FOUND", "Machine not found");
}

/** The user's own machine `id`, ready to be sent to. */
export async function reachableMachine(
	userSub: string,
	id: string,
): Promise<{ row: StoredTunnelLink; token: string; forwardUrl: string }> {
	const row = isValidObjectId(id)
		? await TunnelLinkModel.findOne({
				_id: id,
				userSub,
				source: "self",
				status: "linked",
			}).lean<StoredTunnelLink>()
		: null;
	if (!row?.forwardUrl || !row.tokenSealed) throw machineNotFound();
	if (row.deadAt) {
		throw new OperationError(
			409,
			"MACHINE_LINK_REVOKED",
			"The machine revoked its link; run `tunelo login` on it again",
		);
	}
	if (row.forwardEnabled === false) {
		throw new OperationError(
			409,
			"MACHINE_FORWARD_OFF",
			"Requests to this machine's localhost are turned off in Localman",
		);
	}
	const token = tuneloRuntime().deps.cipher.decrypt(
		row.tokenSealed,
		linkTokenSlot(userSub, String(row._id)),
	);
	return { row, token, forwardUrl: row.forwardUrl };
}

/**
 * Where a request for `localhost:<port><path>` on machine `id` goes: the
 * machine tunnel's forward path, with the link token and the port as
 * headers the proxy adds (and drops on a redirect to another origin).
 */
export async function machineRoute(
	userSub: string,
	id: string,
	target: URL,
	port: number,
): Promise<MachineRoute> {
	const { token, forwardUrl } = await reachableMachine(userSub, id);
	return {
		url: `${forwardUrl}${target.pathname}${target.search}`,
		tunnel: machineOrigin(forwardUrl),
		headers: [
			{ name: FORWARD_HEADERS.access, value: token },
			{ name: FORWARD_HEADERS.localPort, value: String(port) },
		],
		machine: id,
		machineToken: token,
	};
}

/** The user's own machines, for `list_machines` (revoked ones included). */
export async function listOwnMachines(userSub: string): Promise<{
	machines: {
		id: string;
		name: string;
		forwardEnabled: boolean;
		revoked: boolean;
		linkedAt: string;
	}[];
}> {
	const rows = await TunnelLinkModel.find({
		userSub,
		source: "self",
		status: "linked",
	})
		.sort({ createdAt: 1 })
		.lean<StoredTunnelLink[]>();
	return {
		machines: rows.map((row) => ({
			id: String(row._id),
			name: row.machineName ?? "",
			forwardEnabled: row.forwardEnabled !== false,
			revoked: Boolean(row.deadAt),
			linkedAt: (row.linkedAt ?? row.createdAt ?? new Date(0)).toISOString(),
		})),
	};
}

/**
 * Redirects a request to a machine may follow: back into the machine's
 * forward path only. Anything else (another host, the machine tunnel's
 * other paths) is answered as the 3xx itself: the request went out
 * through the user's machine, and Localman must not carry it elsewhere.
 */
export function staysOnMachine(tunnel: string): (to: URL) => boolean {
	return (to) =>
		to.origin === tunnel &&
		(to.pathname === FORWARD_PATH ||
			to.pathname.startsWith(`${FORWARD_PATH}/`));
}
