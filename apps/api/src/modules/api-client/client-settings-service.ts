import { OperationError } from "@localman/operations";
import {
	DEFAULT_REQUEST_SETTINGS,
	type RouteMode,
} from "@localman/shared/api-client";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import {
	ClientSettingsModel,
	type HostListField,
	MAX_ROUTING_HOSTS,
	MAX_SECRET_PROXY_HOSTS,
	MAX_TUNNEL_MAPPINGS,
	type StoredClientSettings,
	type TunnelMapping,
} from "./client-settings-model.js";

export interface ClientSettingsView {
	routingHosts: string[];
	secretProxyHosts: string[];
	tunnelMappings: TunnelMapping[];
	defaultRoute: RouteMode;
	sendClientIp: boolean;
	/** `TUNNEL_DOMAINS`: the only hosts a tunnel mapping may use. */
	tunnelDomains: string[];
}

export interface ClientDefaultsInput {
	readonly defaultRoute?: RouteMode;
	readonly sendClientIp?: boolean;
}

function limitReached(code: string, what: string, max: number): OperationError {
	return new OperationError(409, code, `At most ${max} ${what}`, { max });
}

/** The user's settings; defaults when nothing was changed yet. */
export async function readClientSettings(
	userSub: string,
): Promise<ClientSettingsView> {
	const doc = await ClientSettingsModel.findOne({
		userSub,
	}).lean<StoredClientSettings>();
	return {
		routingHosts: doc?.routingHosts ?? [],
		secretProxyHosts: doc?.secretProxyHosts ?? [],
		tunnelMappings: (doc?.tunnelMappings ?? []).map(
			({ key, url, enabled }) => ({ key, url, enabled: enabled ?? true }),
		),
		defaultRoute: doc?.defaultRoute ?? DEFAULT_REQUEST_SETTINGS.route,
		sendClientIp: doc?.sendClientIp ?? DEFAULT_REQUEST_SETTINGS.sendClientIp,
		tunnelDomains: [...tenantSettings().tunnelDomains],
	};
}

/**
 * Creates the user's record if missing. The filter is an equality on the
 * unique `userSub`, so MongoDB retries a concurrent duplicate upsert.
 */
async function ensureSettings(userSub: string): Promise<void> {
	await ClientSettingsModel.updateOne(
		{ userSub },
		{ $setOnInsert: { userSub } },
		{ upsert: true },
	);
}

export async function updateClientDefaults(
	userSub: string,
	input: ClientDefaultsInput,
): Promise<ClientSettingsView> {
	const changes = {
		...(input.defaultRoute === undefined
			? {}
			: { defaultRoute: input.defaultRoute }),
		...(input.sendClientIp === undefined
			? {}
			: { sendClientIp: input.sendClientIp }),
	};
	if (Object.keys(changes).length > 0) {
		await ClientSettingsModel.updateOne(
			{ userSub },
			{ $set: changes },
			{ upsert: true },
		);
	}
	return readClientSettings(userSub);
}

const HOST_LISTS: Readonly<
	Record<HostListField, { max: number; code: string; what: string }>
> = {
	routingHosts: {
		max: MAX_ROUTING_HOSTS,
		code: "ROUTING_HOST_LIMIT_REACHED",
		what: "hosts pinned to the proxy",
	},
	secretProxyHosts: {
		max: MAX_SECRET_PROXY_HOSTS,
		code: "SECRET_PROXY_HOST_LIMIT_REACHED",
		what: "hosts allowed to send secrets through the proxy",
	},
};

/** Adds `host` (already normalized) to a list; a listed host is kept once. */
export async function addHost(
	userSub: string,
	field: HostListField,
	host: string,
): Promise<ClientSettingsView> {
	const { max, code, what } = HOST_LISTS[field];
	await ensureSettings(userSub);
	const added = await ClientSettingsModel.updateOne(
		{
			userSub,
			[field]: { $ne: host },
			[`${field}.${max - 1}`]: { $exists: false },
		},
		{ $push: { [field]: host } },
	);
	const view = await readClientSettings(userSub);
	if (added.matchedCount === 0 && !view[field].includes(host)) {
		throw limitReached(code, what, max);
	}
	return view;
}

export async function removeHost(
	userSub: string,
	field: HostListField,
	host: string,
): Promise<ClientSettingsView> {
	await ClientSettingsModel.updateOne(
		{ userSub },
		{ $pull: { [field]: host } },
	);
	return readClientSettings(userSub);
}

function replaceTunnelMapping(userSub: string, mapping: TunnelMapping) {
	return ClientSettingsModel.updateOne(
		{ userSub, "tunnelMappings.key": mapping.key },
		{
			$set: {
				"tunnelMappings.$.url": mapping.url,
				"tunnelMappings.$.enabled": mapping.enabled,
			},
		},
	);
}

/** Sets the tunnel of a local target (`key`, `url` already normalized). */
export async function putTunnelMapping(
	userSub: string,
	mapping: TunnelMapping,
): Promise<ClientSettingsView> {
	await ensureSettings(userSub);
	if ((await replaceTunnelMapping(userSub, mapping)).matchedCount > 0) {
		return readClientSettings(userSub);
	}
	const added = await ClientSettingsModel.updateOne(
		{
			userSub,
			"tunnelMappings.key": { $ne: mapping.key },
			[`tunnelMappings.${MAX_TUNNEL_MAPPINGS - 1}`]: { $exists: false },
		},
		{ $push: { tunnelMappings: { ...mapping } } },
	);
	if (added.matchedCount === 0) {
		// Either the cap, or the same key added concurrently: replace it then.
		if ((await replaceTunnelMapping(userSub, mapping)).matchedCount === 0) {
			throw limitReached(
				"TUNNEL_MAPPING_LIMIT_REACHED",
				"tunnel mappings",
				MAX_TUNNEL_MAPPINGS,
			);
		}
	}
	return readClientSettings(userSub);
}

export async function removeTunnelMapping(
	userSub: string,
	key: string,
): Promise<ClientSettingsView> {
	await ClientSettingsModel.updateOne(
		{ userSub },
		{ $pull: { tunnelMappings: { key } } },
	);
	return readClientSettings(userSub);
}
