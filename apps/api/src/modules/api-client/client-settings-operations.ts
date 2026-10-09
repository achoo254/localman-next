import { defineOperation } from "@localman/operations";
import { MAX_URL_LENGTH, ROUTE_MODES } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	MAX_HOST_LENGTH,
	normalizeRoutingHost,
	normalizeTunnelKey,
	normalizeTunnelUrl,
} from "./client-settings-input.js";
import {
	MAX_ROUTING_HOSTS,
	MAX_TUNNEL_MAPPINGS,
} from "./client-settings-model.js";
import {
	addRoutingHost,
	putTunnelMapping,
	readClientSettings,
	removeRoutingHost,
	removeTunnelMapping,
	updateClientDefaults,
} from "./client-settings-service.js";

const DIRECT_SEND_ONLY =
	"only the browser's direct send reads remembered hosts; the send_request tool always goes through the proxy";

const settingsView = z.object({
	routingHosts: z.array(z.string()),
	tunnelMappings: z.array(z.object({ key: z.string(), url: z.string() })),
	defaultRoute: z.enum(ROUTE_MODES),
	sendClientIp: z.boolean(),
});

const host = z.string().min(1).max(MAX_HOST_LENGTH);
const key = z.string().min(1).max(MAX_HOST_LENGTH);

const ABOUT =
	"Routing settings of the API client, own settings only: hosts remembered to go through the proxy, manual tunnel URLs for local targets (localhost:port), and the default route and client-IP forwarding of new tabs.";

const write = {
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	output: settingsView,
} as const;

export const getClientSettings = defineOperation({
	id: "client.getClientSettings",
	method: "GET",
	path: "/client/settings",
	summary: "Get the API client's routing settings",
	description: ABOUT,
	input: z.object({}),
	output: settingsView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx) => readClientSettings(requireSubject(ctx)),
});

export const updateClientSettings = defineOperation({
	...write,
	id: "client.updateClientSettings",
	method: "PUT",
	path: "/client/settings",
	summary: "Set the API client's default route and client-IP forwarding",
	description: `${ABOUT} Omitted fields keep their value. defaultRoute: auto (direct when possible, else proxy or tunnel), direct or proxy.`,
	input: z.object({
		defaultRoute: z.enum(ROUTE_MODES).optional(),
		sendClientIp: z.boolean().optional(),
	}),
	mcp: true,
	handler: async (ctx, input) =>
		updateClientDefaults(requireSubject(ctx), input),
});

export const rememberRoutingHost = defineOperation({
	...write,
	id: "client.rememberRoutingHost",
	method: "PUT",
	path: "/client/routing-hosts/:host",
	summary: "Remember a host as needing the proxy",
	description: `${ABOUT} \`host\` is host[:port] as in the URL. At most ${MAX_ROUTING_HOSTS} hosts (409 ROUTING_HOST_LIMIT_REACHED).`,
	input: z.object({ host }),
	mcp: { exempt: DIRECT_SEND_ONLY },
	handler: async (ctx, input) =>
		addRoutingHost(requireSubject(ctx), normalizeRoutingHost(input.host)),
});

export const forgetRoutingHost = defineOperation({
	...write,
	id: "client.forgetRoutingHost",
	method: "DELETE",
	path: "/client/routing-hosts/:host",
	summary: "Forget a host remembered as needing the proxy",
	input: z.object({ host }),
	mcp: { exempt: DIRECT_SEND_ONLY },
	handler: async (ctx, input) =>
		removeRoutingHost(requireSubject(ctx), normalizeRoutingHost(input.host)),
});

export const setTunnelMapping = defineOperation({
	...write,
	id: "client.setTunnelMapping",
	method: "PUT",
	path: "/client/tunnel-mappings/:key",
	summary: "Send a local target (localhost:port) through a tunnel URL",
	description: `${ABOUT} \`key\` is a local host and port (loopback spellings become localhost); \`url\` a public http(s) URL whose origin replaces the local one. At most ${MAX_TUNNEL_MAPPINGS} mappings (409 TUNNEL_MAPPING_LIMIT_REACHED).`,
	input: z.object({ key, url: z.string().min(1).max(MAX_URL_LENGTH) }),
	mcp: true,
	handler: async (ctx, input) =>
		putTunnelMapping(requireSubject(ctx), {
			key: normalizeTunnelKey(input.key),
			url: normalizeTunnelUrl(input.url),
		}),
});

export const deleteTunnelMapping = defineOperation({
	...write,
	id: "client.deleteTunnelMapping",
	method: "DELETE",
	path: "/client/tunnel-mappings/:key",
	summary: "Remove the tunnel URL of a local target",
	description: ABOUT,
	input: z.object({ key }),
	mcp: true,
	handler: async (ctx, input) =>
		removeTunnelMapping(requireSubject(ctx), normalizeTunnelKey(input.key)),
});

export const clientSettingsOperations = [
	getClientSettings,
	updateClientSettings,
	rememberRoutingHost,
	forgetRoutingHost,
	setTunnelMapping,
	deleteTunnelMapping,
] as const;
