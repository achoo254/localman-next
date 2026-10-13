import { defineOperation } from "@localman/operations";
import { MAX_URL_LENGTH } from "@localman/shared/api-client";
import { z } from "zod";
import { requireSubject } from "../../http/require-auth.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import {
	MAX_HOST_LENGTH,
	invalidTunnelUrl,
	normalizeTunnelKey,
	normalizeTunnelUrl,
} from "./client-settings-input.js";
import { MAX_TUNNEL_MAPPINGS } from "./client-settings-model.js";
import {
	putTunnelMapping,
	removeTunnelMapping,
} from "./client-settings-service.js";
import {
	CREDENTIAL_DESTINATION,
	SETTINGS_ABOUT,
	settingsWrite,
} from "./client-settings-view.js";

const key = z.string().min(1).max(MAX_HOST_LENGTH);

export const setTunnelMapping = defineOperation({
	...settingsWrite,
	id: "client.setTunnelMapping",
	method: "PUT",
	path: "/client/tunnel-mappings/:key",
	summary: "Send a local target (localhost:port) through a tunnel URL",
	description: `${SETTINGS_ABOUT} \`key\` is a local host and port (loopback spellings become localhost); \`url\` a Tunelo tunnel https://<name>.<domain>, the domain one of tunnelDomains, without port, path or query (400 VALIDATION_ERROR otherwise); its origin replaces the local one. \`enabled\` (default true) turns the mapping off without deleting it. At most ${MAX_TUNNEL_MAPPINGS} mappings (409 TUNNEL_MAPPING_LIMIT_REACHED).`,
	input: z.object({
		key,
		url: z.string().min(1).max(MAX_URL_LENGTH),
		enabled: z.boolean().optional(),
	}),
	mcp: { exempt: CREDENTIAL_DESTINATION },
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const mappingKey = normalizeTunnelKey(input.key);
		const domains = tenantSettings().tunnelDomains;
		const url = normalizeTunnelUrl(input.url, domains);
		if (url === null) throw await invalidTunnelUrl(sub, domains);
		return putTunnelMapping(sub, {
			key: mappingKey,
			url,
			enabled: input.enabled ?? true,
		});
	},
});

export const deleteTunnelMapping = defineOperation({
	...settingsWrite,
	id: "client.deleteTunnelMapping",
	method: "DELETE",
	path: "/client/tunnel-mappings/:key",
	summary: "Remove the tunnel URL of a local target",
	description: SETTINGS_ABOUT,
	input: z.object({ key }),
	mcp: { exempt: CREDENTIAL_DESTINATION },
	handler: async (ctx, input) =>
		removeTunnelMapping(requireSubject(ctx), normalizeTunnelKey(input.key)),
});
