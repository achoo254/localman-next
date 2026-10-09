/**
 * Pieces of a v2.1 item read from untrusted JSON: auth, scripts, URL,
 * params and headers. Unknown kinds become warnings, never errors, so one
 * odd request does not fail the whole collection.
 */
import type {
	KeyValueRow,
	RequestAuth,
	RequestScripts,
} from "../request-model.js";
import { parseQueryFromUrl } from "../url-params.js";
import { type ImportContext, checkScriptApi } from "./import-context.js";
import { paramText } from "./import-error.js";
import {
	descriptionOf,
	isRecord,
	listProp,
	prop,
	recordProp,
	textOf,
	textProp,
} from "./import-json.js";

/** v2.1 attributes are `[{ key, value }]`; v2.0 used `{ key: value }`. */
function authAttribute(attributes: unknown, key: string): string {
	if (Array.isArray(attributes)) {
		const found = attributes.find((a) => textProp(a, "key") === key);
		return textProp(found, "value");
	}
	return textProp(attributes, key);
}

/** `null` when the item sets no auth (it inherits from its parent). */
export function readAuth(
	value: unknown,
	ctx: ImportContext,
	path: string,
): RequestAuth | null {
	if (!isRecord(value)) return null;
	const type = textProp(value, "type");
	const attrs = prop(value, type);
	switch (type) {
		case "inherit":
			return { type: "inherit" };
		case "noauth":
			return { type: "none" };
		case "bearer":
			return { type: "bearer", token: authAttribute(attrs, "token") };
		case "basic":
			return {
				type: "basic",
				username: authAttribute(attrs, "username"),
				password: authAttribute(attrs, "password"),
			};
		case "apikey":
			return {
				type: "apikey",
				key: authAttribute(attrs, "key"),
				value: authAttribute(attrs, "value"),
				in: authAttribute(attrs, "in") === "query" ? "query" : "header",
			};
		default:
			ctx.warn("UNSUPPORTED_AUTH", path, { type: paramText(type) });
			return { type: "none" };
	}
}

/** `prerequest` and `test` events; `exec` is a list of lines or a string. */
export function readScripts(
	events: readonly unknown[],
	ctx: ImportContext,
	path: string,
): RequestScripts {
	const scripts: RequestScripts = { pre: "", post: "" };
	for (const event of events) {
		if (prop(event, "disabled") === true) continue;
		const exec = prop(recordProp(event, "script"), "exec");
		const lines = Array.isArray(exec) ? exec.map((l) => textOf(l) ?? "") : [];
		const text = typeof exec === "string" ? exec : lines.join("\n");
		const listen = textProp(event, "listen");
		if (!text.trim()) continue;
		checkScriptApi(text, ctx, path);
		if (listen === "prerequest") scripts.pre = text;
		else if (listen === "test") scripts.post = text;
	}
	return scripts;
}

/** `/:key` segments of the URL's path replaced with `value`. */
function fillPathVariable(url: string, key: string, value: string): string {
	const [beforeQuery, ...rest] = url.split(/(?=[?#])/);
	const path = beforeQuery
		.split("/")
		.map((segment) => (segment === `:${key}` ? value : segment))
		.join("/");
	return [path, ...rest].join("");
}

export function urlPart(value: unknown, separator: string): string {
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return "";
	return value
		.map((segment) => textOf(segment) ?? textProp(segment, "value"))
		.join(separator);
}

/** `raw`, or the URL rebuilt from its parts; `:name` path variables filled. */
export function readUrl(value: unknown): string {
	if (typeof value === "string") return value;
	let url = textProp(value, "raw");
	if (!url && isRecord(value)) {
		const protocol = textProp(value, "protocol");
		const port = textProp(value, "port");
		const query = listProp(value, "query")
			.filter((q) => prop(q, "disabled") !== true)
			.map((q) => `${textProp(q, "key")}=${textProp(q, "value")}`)
			.join("&");
		url =
			(protocol ? `${protocol}://` : "") +
			urlPart(prop(value, "host"), ".") +
			(port ? `:${port}` : "") +
			(prop(value, "path") === undefined
				? ""
				: `/${urlPart(prop(value, "path"), "/")}`) +
			(query ? `?${query}` : "");
	}
	for (const variable of listProp(value, "variable")) {
		const key = textProp(variable, "key");
		const filled = textProp(variable, "value");
		if (key && filled) url = fillPathVariable(url, key, filled);
	}
	return url;
}

/** Items of a key/value list that have a key. */
export function keyedItems(list: readonly unknown[]): unknown[] {
	return list.filter((item) => textOf(prop(item, "key")) !== null);
}

export function readRow(item: unknown, ctx: ImportContext): KeyValueRow {
	const row: KeyValueRow = {
		id: ctx.newId(),
		key: textProp(item, "key"),
		value: textProp(item, "value"),
		enabled: prop(item, "disabled") !== true,
	};
	const description = descriptionOf(prop(item, "description"));
	if (description) row.description = description;
	return row;
}

export function readRows(
	list: readonly unknown[],
	ctx: ImportContext,
): KeyValueRow[] {
	return keyedItems(list).map((item) => readRow(item, ctx));
}

/** Query rows of `url.query` (they keep disabled ones), else of the raw URL. */
export function readParams(
	value: unknown,
	url: string,
	ctx: ImportContext,
): KeyValueRow[] {
	const query = listProp(value, "query");
	return query.length > 0
		? readRows(query, ctx)
		: parseQueryFromUrl(url, ctx.newId);
}

/** A header list, or the old `"Name: value\n…"` string form. */
export function readHeaders(value: unknown, ctx: ImportContext): KeyValueRow[] {
	if (typeof value !== "string") {
		return readRows(Array.isArray(value) ? value : [], ctx);
	}
	return value
		.split(/\r?\n/)
		.filter((line) => line.includes(":"))
		.map((line) => {
			const colon = line.indexOf(":");
			const key = line.slice(0, colon).trim();
			return {
				id: ctx.newId(),
				key,
				value: line.slice(colon + 1).trim(),
				enabled: true,
			};
		});
}
