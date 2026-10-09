/**
 * Routing settings of the API client on the server (`/client/settings`,
 * own settings only): hosts pinned to the proxy, hosts where credentials
 * may go through the proxy without asking, manual tunnel mappings, the
 * default route of new tabs, and the server's tunnel domains (read only).
 * Every write answers the whole settings.
 */
import { ROUTE_MODES, type RouteMode } from "@localman/shared/api-client";
import { apiRequest } from "../../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	isRecord,
} from "../../../lib/json-guards";

const BASE = "/api/v1/client";

export interface TunnelMapping {
	/** Local target key: `localhost:3000`, `192.168.1.5:8080`. */
	key: string;
	/** Origin of the tunnel, e.g. `https://demo.tunnel.hoandat.com`. */
	url: string;
	enabled: boolean;
}

export interface ClientSettings {
	routingHosts: string[];
	secretProxyHosts: string[];
	tunnelMappings: TunnelMapping[];
	defaultRoute: RouteMode;
	sendClientIp: boolean;
	/**
	 * Domains a tunnel URL must sit under (`tunnel.hoandat.com`); the server
	 * refuses a mapping elsewhere. Empty when the server sets none.
	 */
	tunnelDomains: string[];
}

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
	routingHosts: [],
	secretProxyHosts: [],
	tunnelMappings: [],
	defaultRoute: "auto",
	sendClientIp: true,
	tunnelDomains: [],
};

function strings(record: Record<string, unknown>, key: string): string[] {
	return expectArray(record, key).map((item) => {
		if (typeof item !== "string") throw new InvalidResponseError(key);
		return item;
	});
}

/** Lower-case domains; a server without the field (older API) has none. */
function tunnelDomains(record: Record<string, unknown>): string[] {
	const value = record.tunnelDomains;
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((domain) => domain.trim().toLowerCase())
		.filter((domain) => domain !== "");
}

function parseRoute(value: string): RouteMode {
	const mode = ROUTE_MODES.find((item) => item === value);
	if (!mode) throw new InvalidResponseError("defaultRoute");
	return mode;
}

export function parseClientSettings(payload: unknown): ClientSettings {
	const record = expectRecord(payload, "client settings");
	return {
		routingHosts: strings(record, "routingHosts"),
		secretProxyHosts: strings(record, "secretProxyHosts"),
		tunnelMappings: expectArray(record, "tunnelMappings").map((item) => {
			if (!isRecord(item)) throw new InvalidResponseError("tunnelMappings");
			return {
				key: expectString(item, "key"),
				url: expectString(item, "url"),
				enabled: expectBoolean(item, "enabled"),
			};
		}),
		defaultRoute: parseRoute(expectString(record, "defaultRoute")),
		sendClientIp: expectBoolean(record, "sendClientIp"),
		tunnelDomains: tunnelDomains(record),
	};
}

async function call(
	method: "GET" | "PUT" | "DELETE",
	path: string,
	body?: unknown,
): Promise<ClientSettings> {
	const payload = await apiRequest(`${BASE}${path}`, {
		method,
		...(body === undefined ? {} : { body }),
	});
	return parseClientSettings(payload);
}

const segment = encodeURIComponent;

export const clientSettingsApi = {
	get: () => call("GET", "/settings"),
	setDefaultRoute: (defaultRoute: RouteMode) =>
		call("PUT", "/settings", { defaultRoute }),
	pinHost: (host: string) => call("PUT", `/routing-hosts/${segment(host)}`),
	unpinHost: (host: string) =>
		call("DELETE", `/routing-hosts/${segment(host)}`),
	allowSecrets: (host: string) =>
		call("PUT", `/secret-proxy-hosts/${segment(host)}`),
	forgetSecrets: (host: string) =>
		call("DELETE", `/secret-proxy-hosts/${segment(host)}`),
	setTunnel: ({ key, url, enabled }: TunnelMapping) =>
		call("PUT", `/tunnel-mappings/${segment(key)}`, { url, enabled }),
	deleteTunnel: (key: string) =>
		call("DELETE", `/tunnel-mappings/${segment(key)}`),
};
