import { ROUTE_MODES, type RouteMode } from "@localman/shared/api-client";
import mongoose, { Schema } from "mongoose";

/** Hosts pinned as "always send through the proxy" per user. */
export const MAX_ROUTING_HOSTS = 200;
/** Hosts where secrets may go through the proxy without asking, per user. */
export const MAX_SECRET_PROXY_HOSTS = 200;
/** Manual `localhost:port` → tunnel URL mappings per user. */
export const MAX_TUNNEL_MAPPINGS = 100;

/**
 * Routing preferences of the API client (`client_settings`), one record
 * per user, created on the first change (reads fall back to defaults).
 *
 * - `routingHosts`: hosts (`host[:port]`, lowercase) that Auto mode always
 *   sends through the proxy. Hosts learnt from a CORS failure are cached
 *   in the browser with an expiry instead, not here.
 * - `secretProxyHosts`: hosts (or local keys such as `localhost:3000`)
 *   where the user agreed, once and for all, that a request carrying
 *   credentials may switch to the proxy or a tunnel without asking.
 * - `tunnelMappings`: a local target key (`localhost:3000`, see
 *   `localTargetKey`) to the origin of a tunnel the user pasted; a
 *   disabled mapping is kept but not used.
 * - `defaultRoute`, `sendClientIp`: defaults of a new tab's settings.
 */
const clientSettingsSchema = new Schema(
	{
		userSub: { type: String, required: true, unique: true },
		routingHosts: { type: [String], default: [] },
		secretProxyHosts: { type: [String], default: [] },
		tunnelMappings: {
			type: [
				{
					_id: false,
					key: { type: String, required: true },
					url: { type: String, required: true },
					enabled: { type: Boolean, default: true },
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
	enabled: boolean;
}

/** Host lists of a record that hold `host[:port]` strings. */
export type HostListField = "routingHosts" | "secretProxyHosts";

export interface StoredClientSettings {
	userSub: string;
	routingHosts?: string[];
	secretProxyHosts?: string[];
	tunnelMappings?: { key: string; url: string; enabled?: boolean }[];
	defaultRoute?: RouteMode;
	sendClientIp?: boolean;
}
