/**
 * `_localman`: what Localman stores and Collection v2.1 has no field for.
 * The official v2.1.0 schema allows unknown properties, so a file with it
 * still validates and other tools ignore it. Request items carry the
 * settings v2.1 lacks (timeout, client IP headers, route); variables carry
 * `secret`, which the schema's variable `type` does not list. Read from
 * untrusted JSON: a wrong value keeps the default.
 */
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "../limits.js";
import {
	DEFAULT_REQUEST_SETTINGS,
	ROUTE_MODES,
	type RequestSettings,
} from "../request-model.js";
import type { CollectionV21SettingsExtension } from "./collection-v21-types.js";
import { prop, recordProp, textProp } from "./import-json.js";

const EXTENSION = "_localman";

/** Settings that differ from the defaults; `undefined` when none do. */
export function settingsExtension(
	settings: RequestSettings,
): CollectionV21SettingsExtension | undefined {
	const defaults = DEFAULT_REQUEST_SETTINGS;
	const out: CollectionV21SettingsExtension = {};
	if (settings.timeoutMs !== defaults.timeoutMs) {
		out.timeoutMs = settings.timeoutMs;
	}
	if (settings.sendClientIp !== defaults.sendClientIp) {
		out.sendClientIp = settings.sendClientIp;
	}
	if (settings.route !== defaults.route) out.route = settings.route;
	return Object.keys(out).length > 0 ? out : undefined;
}

function isTimeout(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= MIN_TIMEOUT_MS &&
		value <= MAX_TIMEOUT_MS
	);
}

/**
 * Settings of a request item: `followRedirects` from
 * `protocolProfileBehavior`, the others from `_localman`.
 */
export function readSettings(item: unknown): RequestSettings {
	const settings: RequestSettings = { ...DEFAULT_REQUEST_SETTINGS };
	const behavior = recordProp(item, "protocolProfileBehavior");
	if (prop(behavior, "followRedirects") === false) {
		settings.followRedirects = false;
	}
	const extension = recordProp(item, EXTENSION);
	const timeoutMs = prop(extension, "timeoutMs");
	if (isTimeout(timeoutMs)) settings.timeoutMs = timeoutMs;
	const sendClientIp = prop(extension, "sendClientIp");
	if (typeof sendClientIp === "boolean") settings.sendClientIp = sendClientIp;
	const route = prop(extension, "route");
	const knownRoute = ROUTE_MODES.find((mode) => mode === route);
	if (knownRoute) settings.route = knownRoute;
	return settings;
}

/** `type: "secret"` (other tools) or `_localman.secret` (Localman). */
export function isSecretVariable(entry: unknown): boolean {
	if (textProp(entry, "type") === "secret") return true;
	return prop(recordProp(entry, EXTENSION), "secret") === true;
}
