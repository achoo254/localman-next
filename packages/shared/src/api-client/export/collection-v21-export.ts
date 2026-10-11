/**
 * A collection tree (imported, or the open tabs) to Collection v2.1 JSON
 * that validates against the official v2.1.0 schema. Writes what
 * `collectionV21ToTree` reads back: folders with their description, auth
 * and scripts; auth left out for `inherit`; scripts as `prerequest`/`test`
 * events; disabled rows flagged; `followRedirects: false` kept. Secret
 * variables and the settings v2.1 has no field for go under `_localman`.
 * Picked files are exported by name only.
 *
 * The file may be shared, so secret variables keep their key and flag but
 * are written with an empty value, as environment exports do.
 *
 * Not kept: secret values, the file bytes and picked-file references, line
 * endings of scripts (CRLF comes back as LF) and blank scripts.
 */
import { settingsExtension } from "../import/collection-v21-extension.js";
import {
	COLLECTION_V21_SCHEMA,
	type CollectionV21,
	type CollectionV21Auth,
	type CollectionV21Event,
	type CollectionV21Folder,
	type CollectionV21Item,
	type CollectionV21RequestItem,
	type CollectionV21Variable,
} from "../import/collection-v21-types.js";
import type {
	CollectionTree,
	ImportedItem,
} from "../import/imported-collection.js";
import type {
	ApiRequestDraft,
	RequestAuth,
	RequestScripts,
} from "../request-model.js";
import { bodyToV21, rowsToV21 } from "./collection-v21-body-export.js";
import { collectionV21Url } from "./collection-v21-url.js";

const attribute = (key: string, value: string) =>
	({ key, value, type: "string" }) as const;

function authToV21(auth: RequestAuth): CollectionV21Auth | undefined {
	switch (auth.type) {
		case "inherit":
			return undefined;
		case "none":
			return { type: "noauth" };
		case "bearer":
			return { type: "bearer", bearer: [attribute("token", auth.token)] };
		case "basic":
			return {
				type: "basic",
				basic: [
					attribute("username", auth.username),
					attribute("password", auth.password),
				],
			};
		case "apikey":
			return {
				type: "apikey",
				apikey: [
					attribute("key", auth.key),
					attribute("value", auth.value),
					attribute("in", auth.in),
				],
			};
	}
}

function eventsToV21(
	scripts: RequestScripts,
): CollectionV21Event[] | undefined {
	const events: CollectionV21Event[] = [];
	const add = (listen: CollectionV21Event["listen"], text: string): void => {
		if (!text.trim()) return;
		const exec = text.split(/\r?\n/);
		events.push({ listen, script: { type: "text/javascript", exec } });
	};
	add("prerequest", scripts.pre);
	add("test", scripts.post);
	return events.length > 0 ? events : undefined;
}

function requestToV21(
	name: string,
	description: string,
	draft: ApiRequestDraft,
): CollectionV21RequestItem {
	const item: CollectionV21RequestItem = {
		name,
		request: {
			method: draft.method,
			header: rowsToV21(draft.headers),
			url: collectionV21Url(draft.url, rowsToV21(draft.params)),
		},
	};
	const body = bodyToV21(draft.body);
	const auth = authToV21(draft.auth);
	const events = eventsToV21(draft.scripts);
	if (body) item.request.body = body;
	if (auth) item.request.auth = auth;
	if (description) item.request.description = description;
	if (events) item.event = events;
	if (!draft.settings.followRedirects) {
		item.protocolProfileBehavior = { followRedirects: false };
	}
	const settings = settingsExtension(draft.settings);
	if (settings) item._localman = settings;
	return item;
}

function itemsToV21(items: readonly ImportedItem[]): CollectionV21Item[] {
	return items.map((item) => {
		if (item.kind === "request") {
			return requestToV21(item.name, item.description, item.draft);
		}
		const folder: CollectionV21Folder = {
			name: item.name,
			item: itemsToV21(item.items),
		};
		const auth = authToV21(item.auth);
		const events = eventsToV21(item.scripts);
		if (item.description) folder.description = item.description;
		if (auth) folder.auth = auth;
		if (events) folder.event = events;
		return folder;
	});
}

/** The collection as v2.1 JSON (stringify it to save a file). */
export function exportCollectionV21(tree: CollectionTree): CollectionV21 {
	const out: CollectionV21 = {
		info: { name: tree.name, schema: COLLECTION_V21_SCHEMA },
		item: itemsToV21(tree.items),
	};
	if (tree.description) out.info.description = tree.description;
	if (tree.auth.type !== "none") out.auth = authToV21(tree.auth);
	const events = eventsToV21(tree.scripts);
	if (events) out.event = events;
	if (tree.variables.length > 0) {
		out.variable = tree.variables.map((variable) => {
			const entry: CollectionV21Variable = {
				key: variable.key,
				value: variable.secret ? "" : variable.value,
				type: "string",
			};
			if (variable.enabled === false) entry.disabled = true;
			if (variable.secret) entry._localman = { secret: true };
			return entry;
		});
	}
	return out;
}
