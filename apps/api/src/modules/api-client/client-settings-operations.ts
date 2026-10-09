import { defineOperation } from "@localman/operations";
import { ROUTE_MODES } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	MAX_HOST_LENGTH,
	normalizeRoutingHost,
} from "./client-settings-input.js";
import {
	MAX_ROUTING_HOSTS,
	MAX_SECRET_PROXY_HOSTS,
} from "./client-settings-model.js";
import {
	addHost,
	readClientSettings,
	removeHost,
	updateClientDefaults,
} from "./client-settings-service.js";
import {
	CREDENTIAL_DESTINATION,
	SETTINGS_ABOUT,
	settingsView,
	settingsWrite,
} from "./client-settings-view.js";
import {
	deleteTunnelMapping,
	setTunnelMapping,
} from "./client-tunnel-operations.js";

const DIRECT_SEND_ONLY =
	"only the browser's direct send reads pinned hosts; the send_request tool always goes through the proxy";
const host = z.string().min(1).max(MAX_HOST_LENGTH);

export const getClientSettings = defineOperation({
	id: "client.getClientSettings",
	method: "GET",
	path: "/client/settings",
	summary: "Get the API client's routing settings",
	description: `${SETTINGS_ABOUT} Read only over MCP: the user changes these settings in the web UI.`,
	input: z.object({}),
	output: settingsView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx) => readClientSettings(requireSubject(ctx)),
});

export const updateClientSettings = defineOperation({
	...settingsWrite,
	id: "client.updateClientSettings",
	method: "PUT",
	path: "/client/settings",
	summary: "Set the API client's default route and client-IP forwarding",
	description: `${SETTINGS_ABOUT} Omitted fields keep their value. defaultRoute: auto (direct when possible, else proxy or tunnel), direct or proxy.`,
	input: z.object({
		defaultRoute: z.enum(ROUTE_MODES).optional(),
		sendClientIp: z.boolean().optional(),
	}),
	mcp: { exempt: CREDENTIAL_DESTINATION },
	handler: async (ctx, input) =>
		updateClientDefaults(requireSubject(ctx), input),
});

export const rememberRoutingHost = defineOperation({
	...settingsWrite,
	id: "client.rememberRoutingHost",
	method: "PUT",
	path: "/client/routing-hosts/:host",
	summary: "Always send a host through the proxy",
	description: `${SETTINGS_ABOUT} \`host\` is host[:port] as in the URL. At most ${MAX_ROUTING_HOSTS} hosts (409 ROUTING_HOST_LIMIT_REACHED).`,
	input: z.object({ host }),
	mcp: { exempt: DIRECT_SEND_ONLY },
	handler: async (ctx, input) =>
		addHost(
			requireSubject(ctx),
			"routingHosts",
			normalizeRoutingHost(input.host),
		),
});

export const forgetRoutingHost = defineOperation({
	...settingsWrite,
	id: "client.forgetRoutingHost",
	method: "DELETE",
	path: "/client/routing-hosts/:host",
	summary: "Stop always sending a host through the proxy",
	input: z.object({ host }),
	mcp: { exempt: DIRECT_SEND_ONLY },
	handler: async (ctx, input) =>
		removeHost(
			requireSubject(ctx),
			"routingHosts",
			normalizeRoutingHost(input.host),
		),
});

export const allowSecretProxyHost = defineOperation({
	...settingsWrite,
	id: "client.allowSecretProxyHost",
	method: "PUT",
	path: "/client/secret-proxy-hosts/:host",
	summary: "Stop asking before credentials for a host go through the proxy",
	description: `${SETTINGS_ABOUT} \`host\` is host[:port] as in the URL, or a local key such as localhost:3000 for a tunnel. At most ${MAX_SECRET_PROXY_HOSTS} hosts (409 SECRET_PROXY_HOST_LIMIT_REACHED).`,
	input: z.object({ host }),
	mcp: { exempt: CREDENTIAL_DESTINATION },
	handler: async (ctx, input) =>
		addHost(
			requireSubject(ctx),
			"secretProxyHosts",
			normalizeRoutingHost(input.host),
		),
});

export const forgetSecretProxyHost = defineOperation({
	...settingsWrite,
	id: "client.forgetSecretProxyHost",
	method: "DELETE",
	path: "/client/secret-proxy-hosts/:host",
	summary: "Ask again before credentials for a host go through the proxy",
	input: z.object({ host }),
	mcp: { exempt: CREDENTIAL_DESTINATION },
	handler: async (ctx, input) =>
		removeHost(
			requireSubject(ctx),
			"secretProxyHosts",
			normalizeRoutingHost(input.host),
		),
});

export const clientSettingsOperations = [
	getClientSettings,
	updateClientSettings,
	rememberRoutingHost,
	forgetRoutingHost,
	allowSecretProxyHost,
	forgetSecretProxyHost,
	setTunnelMapping,
	deleteTunnelMapping,
] as const;
