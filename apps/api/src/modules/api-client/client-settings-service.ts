import { OperationError } from "@localman/operations";
import {
	DEFAULT_REQUEST_SETTINGS,
	type RouteMode,
} from "@localman/shared/api-client";
import {
	ClientSettingsModel,
	MAX_ROUTING_HOSTS,
	MAX_TUNNEL_MAPPINGS,
	type StoredClientSettings,
	type TunnelMapping,
} from "./client-settings-model.js";

export interface ClientSettingsView {
	routingHosts: string[];
	tunnelMappings: TunnelMapping[];
	defaultRoute: RouteMode;
	sendClientIp: boolean;
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
		tunnelMappings: (doc?.tunnelMappings ?? []).map(({ key, url }) => ({
			key,
			url,
		})),
		defaultRoute: doc?.defaultRoute ?? DEFAULT_REQUEST_SETTINGS.route,
		sendClientIp: doc?.sendClientIp ?? DEFAULT_REQUEST_SETTINGS.sendClientIp,
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

/** Adds `host` (already normalized); a host already listed is kept once. */
export async function addRoutingHost(
	userSub: string,
	host: string,
): Promise<ClientSettingsView> {
	await ensureSettings(userSub);
	const added = await ClientSettingsModel.updateOne(
		{
			userSub,
			routingHosts: { $ne: host },
			[`routingHosts.${MAX_ROUTING_HOSTS - 1}`]: { $exists: false },
		},
		{ $push: { routingHosts: host } },
	);
	const view = await readClientSettings(userSub);
	if (added.matchedCount === 0 && !view.routingHosts.includes(host)) {
		throw limitReached(
			"ROUTING_HOST_LIMIT_REACHED",
			"remembered hosts",
			MAX_ROUTING_HOSTS,
		);
	}
	return view;
}

export async function removeRoutingHost(
	userSub: string,
	host: string,
): Promise<ClientSettingsView> {
	await ClientSettingsModel.updateOne(
		{ userSub },
		{ $pull: { routingHosts: host } },
	);
	return readClientSettings(userSub);
}

function replaceTunnelUrl(userSub: string, mapping: TunnelMapping) {
	return ClientSettingsModel.updateOne(
		{ userSub, "tunnelMappings.key": mapping.key },
		{ $set: { "tunnelMappings.$.url": mapping.url } },
	);
}

/** Sets the tunnel of a local target (`key`, `url` already normalized). */
export async function putTunnelMapping(
	userSub: string,
	mapping: TunnelMapping,
): Promise<ClientSettingsView> {
	await ensureSettings(userSub);
	if ((await replaceTunnelUrl(userSub, mapping)).matchedCount > 0) {
		return readClientSettings(userSub);
	}
	const added = await ClientSettingsModel.updateOne(
		{
			userSub,
			"tunnelMappings.key": { $ne: mapping.key },
			[`tunnelMappings.${MAX_TUNNEL_MAPPINGS - 1}`]: { $exists: false },
		},
		{ $push: { tunnelMappings: { key: mapping.key, url: mapping.url } } },
	);
	if (added.matchedCount === 0) {
		// Either the cap, or the same key added concurrently: replace it then.
		if ((await replaceTunnelUrl(userSub, mapping)).matchedCount === 0) {
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
