/**
 * Collection format v2.1 (schema below), as the exporter writes it. The
 * importer reads untrusted JSON through `import-json.ts` instead of these
 * types, and also accepts v2.0 files (same shape, older auth attributes).
 * The UI calls the format "Collection v2.1"; vendor names stay in this
 * package.
 *
 * Every export validates against the official v2.1.0 JSON Schema, which
 * allows unknown properties. What Localman stores and v2.1 has no place
 * for goes under `_localman` (`collection-v21-extension.ts`).
 */
import type { CollectionStatus } from "../collections/collection-model.js";
import type { RawLanguage, RouteMode } from "../request-model.js";

export const COLLECTION_V21_SCHEMA =
	"https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

/** `info.schema` of a v2.0 or v2.1 collection. */
export const COLLECTION_V2_SCHEMA_PATTERN = /\/collection\/v2\.[01]\.\d+\//;

export interface CollectionV21KeyValue {
	key: string;
	value: string;
	disabled?: boolean;
	description?: string;
}

export interface CollectionV21FormField extends CollectionV21KeyValue {
	type: "text" | "file";
	/** File name of a file field (the bytes are never exported). */
	src?: string;
	contentType?: string;
}

export interface CollectionV21AuthAttribute {
	key: string;
	value: string;
	type: "string";
}

export interface CollectionV21Auth {
	type: "noauth" | "bearer" | "basic" | "apikey";
	bearer?: CollectionV21AuthAttribute[];
	basic?: CollectionV21AuthAttribute[];
	apikey?: CollectionV21AuthAttribute[];
}

export interface CollectionV21Url {
	raw: string;
	protocol?: string;
	host?: string[];
	port?: string;
	path?: string[];
	query?: CollectionV21KeyValue[];
	hash?: string;
}

export const COLLECTION_V21_RAW_LANGUAGES = [
	"json",
	"text",
	"javascript",
	"html",
	"xml",
] as const;

/**
 * `mode` is the kind that is sent; the other kinds are kept so switching
 * back loses nothing. No `mode` and `disabled: true`: no body is sent.
 */
export interface CollectionV21Body {
	mode?: "raw" | "urlencoded" | "formdata" | "file";
	disabled?: boolean;
	raw?: string;
	options?: { raw: { language: string } };
	urlencoded?: CollectionV21KeyValue[];
	formdata?: CollectionV21FormField[];
	file?: { src: string };
}

export interface CollectionV21Event {
	listen: "prerequest" | "test";
	script: { type: "text/javascript"; exec: string[] };
}

export interface CollectionV21Request {
	method: string;
	header: CollectionV21KeyValue[];
	url: CollectionV21Url;
	body?: CollectionV21Body;
	auth?: CollectionV21Auth;
	description?: string;
}

/** Request settings v2.1 has no field for; only non-default ones. */
export interface CollectionV21SettingsExtension {
	timeoutMs?: number;
	sendClientIp?: boolean;
	route?: RouteMode;
}

/** A saved example (`response[]` entry); cookies and timings not written. */
export interface CollectionV21Response {
	name: string;
	originalRequest: CollectionV21Request;
	status: string;
	code: number;
	header: CollectionV21KeyValue[];
	body: string;
	_postman_previewlanguage: RawLanguage;
}

export interface CollectionV21RequestItem {
	name: string;
	request: CollectionV21Request;
	event?: CollectionV21Event[];
	/** Only `followRedirects: false` is written (true is the default). */
	protocolProfileBehavior?: { followRedirects: boolean };
	_localman?: CollectionV21SettingsExtension;
	response?: CollectionV21Response[];
}

export interface CollectionV21Folder {
	name: string;
	description?: string;
	item: CollectionV21Item[];
	auth?: CollectionV21Auth;
	event?: CollectionV21Event[];
}

export type CollectionV21Item = CollectionV21RequestItem | CollectionV21Folder;

/**
 * The v2.1.0 schema has no `secret` type, so a secret variable is written
 * as `string` with `_localman.secret` and an empty value (exports may be
 * shared); the importer reads both forms.
 */
export interface CollectionV21Variable {
	key: string;
	value: string;
	type: "string";
	disabled?: boolean;
	_localman?: { secret: true };
}

/** Tags (lower-case) and status of the collection; Localman only. */
export interface CollectionV21CollectionExtension {
	tags?: string[];
	status?: CollectionStatus;
}

export interface CollectionV21 {
	info: { name: string; description?: string; schema: string };
	item: CollectionV21Item[];
	auth?: CollectionV21Auth;
	event?: CollectionV21Event[];
	variable?: CollectionV21Variable[];
	_localman?: CollectionV21CollectionExtension;
}
