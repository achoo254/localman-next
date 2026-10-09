import { ROUTE_MODES, type RouteMode } from "@localman/shared/api-client";
import mongoose, { Schema } from "mongoose";

/** Hosts remembered as "send through the proxy" per user. */
export const MAX_ROUTING_HOSTS = 200;
/** Manual `localhost:port` → tunnel URL mappings per user. */
export const MAX_TUNNEL_MAPPINGS = 100;

/**
 * Routing preferences of the API client (`client_settings`), one record
 * per user, created on the first change (reads fall back to defaults).
 *
 * - `routingHosts`: hosts (`host[:port]`, lowercase) that failed a direct
 *   send from the browser (CORS), so Auto mode goes through the proxy.
 * - `tunnelMappings`: a local target key (`localhost:3000`, see
 *   `localTargetKey`) to the origin of a tunnel the user pasted.
 * - `defaultRoute`, `sendClientIp`: defaults of a new tab's settings.
 */
const clientSettingsSchema = new Schema(
	{
		userSub: { type: String, required: true, unique: true },
		routingHosts: { type: [String], default: [] },
		tunnelMappings: {
			type: [
				{
					_id: false,
					key: { type: String, required: true },
					url: { type: String, required: true },
				},
			],
			default: [],
		},
		defaultRoute: { type: String, enum: [...ROUTE_MODES], default: "auto" },
		sendClientIp: { type: Boolean, default: true },
	},
	{ collection: "client_settings", timestamps: true, versionKey: false },
);

export const ClientSettingsModel = mongoose.model(
	"ClientSettings",
	clientSettingsSchema,
);

export interface TunnelMapping {
	key: string;
	url: string;
}

export interface StoredClientSettings {
	userSub: string;
	routingHosts?: string[];
	tunnelMappings?: TunnelMapping[];
	defaultRoute?: RouteMode;
	sendClientIp?: boolean;
}
