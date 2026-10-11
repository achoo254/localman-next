/**
 * `_localman`: what Localman stores and Collection v2.1 has no field for.
 * The official v2.1.0 schema allows unknown properties, so a file with it
 * still validates and other tools ignore it. Request items carry the
 * settings v2.1 lacks (timeout, client IP headers, route); variables carry
 * `secret`, which the schema's variable `type` does not list; the
 * collection carries its tags and status. Read from untrusted JSON: a
 * wrong setting keeps the default, invalid tags or status are dropped
 * with a warning.
 */
import {
	COLLECTION_TAGS_MAX,
	collectionStatusSchema,
	normalizeTags,
} from "../collections/collection-tags.js";
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "../limits.js";
import {
	DEFAULT_REQUEST_SETTINGS,
	ROUTE_MODES,
	type RequestSettings,
} from "../request-model.js";
import type {
	CollectionV21CollectionExtension,
	CollectionV21SettingsExtension,
} from "./collection-v21-types.js";
import type { ImportContext } from "./import-context.js";
import { prop, recordProp, textProp } from "./import-json.js";
import type { CollectionTree } from "./imported-collection.js";

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

/** Tags and status of the collection; `undefined` when it has neither. */
export function collectionExtension(
	tree: Pick<CollectionTree, "tags" | "status">,
): CollectionV21CollectionExtension | undefined {
	const out: CollectionV21CollectionExtension = {};
	if (tree.tags.length > 0) out.tags = [...tree.tags];
	if (tree.status) out.status = tree.status;
	return Object.keys(out).length > 0 ? out : undefined;
}

/** Valid tags, normalized (lower-case, unique); `invalid` when any was dropped. */
function readTags(value: unknown): { tags: string[]; invalid: boolean } {
	if (value === undefined) return { tags: [], invalid: false };
	const list: readonly unknown[] = Array.isArray(value) ? value : [value];
	const strings = list.filter((tag): tag is string => typeof tag === "string");
	const { tags, problems } = normalizeTags(strings);
	const bad = new Set(problems.map((problem) => problem.tag));
	const valid = tags.filter((tag) => !bad.has(tag));
	return {
		tags: valid.slice(0, COLLECTION_TAGS_MAX),
		invalid: problems.length > 0 || strings.length < list.length,
	};
}

/** Tags and status from the collection's `_localman`. */
export function readCollectionExtension(
	collection: unknown,
	ctx: ImportContext,
): Pick<CollectionTree, "tags" | "status"> {
	const extension = recordProp(collection, EXTENSION);
	const { tags, invalid } = readTags(prop(extension, "tags"));
	if (invalid) ctx.warn("INVALID_METADATA", "", { field: "tags" });
	const statusValue = prop(extension, "status");
	if (statusValue === undefined || statusValue === null) {
		return { tags, status: null };
	}
	const status = collectionStatusSchema.safeParse(statusValue);
	if (!status.success) ctx.warn("INVALID_METADATA", "", { field: "status" });
	return { tags, status: status.success ? status.data : null };
}
