/**
 * The user's Tunelo tunnels and linked machines on the server
 * (`/client/local-tunnels`, `/client/tunnel-links`, flag `tuneloAccounts`).
 * Tokens never reach the browser: only tunnel origins and machine names.
 */
import { apiRequest } from "../../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../../lib/json-guards";

const BASE = "/api/v1/client";

/**
 * One live tunnel of the user's account or of a linked machine, or
 * (`source: machine`) `localhost` on one of the user's own machines.
 */
export interface LocalTunnel {
	source: "account" | "link" | "machine";
	/** The linked machine (`link` and `machine`). */
	linkId: string | null;
	protocol: "http" | "tcp";
	/** Origin of an HTTP tunnel, or `tcp://host:port`. */
	url: string;
	localPort: number | null;
	deviceName: string;
	/** Visitors pass Basic Auth, with the request's `Authorization`. */
	basicAuth: boolean;
}

export interface LinkedMachine {
	id: string;
	/**
	 * `self`: the user's own machine, linked by `tunelo login`; `pairing`:
	 * an anonymous machine linked with a code before that flow was retired.
	 */
	source: "pairing" | "self";
	/** Localman may send to its localhost (`self` only). */
	forwardEnabled: boolean;
	/** `null` until one of the machine's tunnels was seen. */
	deviceName: string | null;
	/** ISO time. */
	linkedAt: string;
	/** Tunelo refused the link (revoked on the machine): only removable. */
	revoked: boolean;
}

function parseTunnel(item: unknown): LocalTunnel {
	if (!isRecord(item)) throw new InvalidResponseError("tunnels");
	const protocol = expectString(item, "protocol");
	if (protocol !== "http" && protocol !== "tcp") {
		throw new InvalidResponseError("protocol");
	}
	const port = item.localPort;
	const source = item.source;
	return {
		source: source === "account" || source === "machine" ? source : "link",
		linkId: optionalString(item, "linkId"),
		protocol,
		url: expectString(item, "url"),
		localPort: typeof port === "number" ? port : null,
		deviceName: expectString(item, "deviceName"),
		basicAuth: expectBoolean(item, "basicAuth"),
	};
}

function parseLink(item: unknown): LinkedMachine {
	if (!isRecord(item)) throw new InvalidResponseError("links");
	return {
		id: expectString(item, "id"),
		source: item.source === "self" ? "self" : "pairing",
		forwardEnabled: item.forwardEnabled === true,
		deviceName: optionalString(item, "deviceName"),
		linkedAt: expectString(item, "linkedAt"),
		revoked: item.revoked === true,
	};
}

export interface MachinePort {
	port: number;
	/** Process listening there, when the machine could tell. */
	name: string | null;
}

function parsePort(item: unknown): MachinePort {
	if (!isRecord(item) || typeof item.port !== "number") {
		throw new InvalidResponseError("ports");
	}
	return { port: item.port, name: optionalString(item, "name") };
}

function parseLinks(payload: unknown): LinkedMachine[] {
	return expectArray(expectRecord(payload, "links"), "links").map(parseLink);
}

const segment = encodeURIComponent;

export const tuneloAccountsApi = {
	/** Tunnels of `port`; `refresh` skips the server's 10-second cache. */
	listTunnels: async (port: number, refresh: boolean) => {
		const query = `port=${port}${refresh ? "&refresh=true" : ""}`;
		const payload = await apiRequest(`${BASE}/local-tunnels?${query}`);
		const record = expectRecord(payload, "local tunnels");
		return expectArray(record, "tunnels").map(parseTunnel);
	},
	listLinks: async () => parseLinks(await apiRequest(`${BASE}/tunnel-links`)),
	setForward: async (id: string, forwardEnabled: boolean) =>
		parseLink(
			await apiRequest(`${BASE}/tunnel-links/${segment(id)}`, {
				method: "PATCH",
				body: { forwardEnabled },
			}),
		),
	/** Loopback ports listening on one of the user's own machines. */
	listMachinePorts: async (id: string): Promise<MachinePort[]> => {
		const payload = await apiRequest(`${BASE}/machines/${segment(id)}/ports`);
		return expectArray(expectRecord(payload, "ports"), "ports").map(parsePort);
	},
	deleteLink: async (id: string) =>
		parseLinks(
			await apiRequest(`${BASE}/tunnel-links/${segment(id)}`, {
				method: "DELETE",
			}),
		),
};
