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

/** One live tunnel of the user's account or of a linked machine. */
export interface LocalTunnel {
	source: "account" | "link";
	/** The linked machine (`link`). */
	linkId: string | null;
	protocol: "http" | "tcp";
	/** Origin of an HTTP tunnel, or `tcp://host:port`. */
	url: string;
	localPort: number | null;
	deviceName: string;
	/** Visitors pass Basic Auth, with the request's `Authorization`. */
	basicAuth: boolean;
}

/** An anonymous machine linked with a code before that flow was retired. */
export interface LinkedMachine {
	id: string;
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
		source: source === "account" ? source : "link",
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
		deviceName: optionalString(item, "deviceName"),
		linkedAt: expectString(item, "linkedAt"),
		revoked: item.revoked === true,
	};
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
	deleteLink: async (id: string) =>
		parseLinks(
			await apiRequest(`${BASE}/tunnel-links/${segment(id)}`, {
				method: "DELETE",
			}),
		),
};
