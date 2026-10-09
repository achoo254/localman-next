/**
 * Collection format v2.1 (schema below), as the exporter writes it. The
 * importer reads untrusted JSON through `import-json.ts` instead of these
 * types, and also accepts v2.0 files (same shape, older auth attributes).
 * The UI calls the format "Collection v2.1"; vendor names stay in this
 * package.
 */

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

export interface CollectionV21Body {
	mode: "raw" | "urlencoded" | "formdata" | "file";
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

export interface CollectionV21RequestItem {
	name: string;
	request: CollectionV21Request;
	event?: CollectionV21Event[];
	/** Only `followRedirects: false` is written (true is the default). */
	protocolProfileBehavior?: { followRedirects: boolean };
}

export interface CollectionV21Folder {
	name: string;
	description?: string;
	item: CollectionV21Item[];
	auth?: CollectionV21Auth;
	event?: CollectionV21Event[];
}

export type CollectionV21Item = CollectionV21RequestItem | CollectionV21Folder;

export interface CollectionV21Variable {
	key: string;
	value: string;
	type: "string" | "secret";
	disabled?: boolean;
}

export interface CollectionV21 {
	info: { name: string; description?: string; schema: string };
	item: CollectionV21Item[];
	auth?: CollectionV21Auth;
	event?: CollectionV21Event[];
	variable?: CollectionV21Variable[];
}
