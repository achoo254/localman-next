/**
 * State shared by one import run: id source, warnings (capped, tagged with
 * the item path), the request budget, and the final clamp that keeps every
 * draft inside the limits `apiRequestDraftSchema` enforces when it is saved.
 */
import {
	MAX_HEADERS,
	MAX_REQUEST_NAME_LENGTH,
	MAX_SCRIPT_LENGTH,
	MAX_TABLE_ROWS,
} from "../limits.js";
import type { ApiRequestDraft, KeyValueRow } from "../request-model.js";
import type {
	RequestImportParams,
	RequestImportWarning,
	RequestImportWarningCode,
} from "./import-error.js";

/** Requests and folders one import may produce. */
export const MAX_IMPORT_ITEMS = 2000;
/** Warnings listed one by one; the rest are counted. */
export const MAX_IMPORT_WARNINGS = 100;

export interface RequestImportOptions {
	/**
	 * Ids of rows and items. Default: a counter (`i1`, `i2`…), unique within
	 * one import; pass `crypto.randomUUID` when ids must be unique globally.
	 */
	newId?: () => string;
}

export interface ImportContext {
	newId: () => string;
	/** Warning about the item at `path` (names joined with `" / "`). */
	warn(
		code: RequestImportWarningCode,
		path: string,
		params?: RequestImportParams,
	): void;
	/** `false` once `MAX_IMPORT_ITEMS` items were taken (warns once). */
	takeItem(path: string): boolean;
	warnings(): RequestImportWarning[];
}

export function createImportContext(
	options: RequestImportOptions = {},
): ImportContext {
	let counter = 0;
	const newId = options.newId ?? (() => `i${++counter}`);
	const list: RequestImportWarning[] = [];
	let dropped = 0;
	let items = 0;
	const warn: ImportContext["warn"] = (code, path, params = {}) => {
		if (list.length < MAX_IMPORT_WARNINGS) list.push({ code, path, params });
		else dropped += 1;
	};
	return {
		newId,
		warn,
		takeItem(path) {
			items += 1;
			if (items === MAX_IMPORT_ITEMS + 1) {
				warn("TRUNCATED", path, { max: MAX_IMPORT_ITEMS });
			}
			return items <= MAX_IMPORT_ITEMS;
		},
		warnings() {
			if (dropped === 0) return [...list];
			return [
				...list,
				{ code: "MORE_WARNINGS", path: "", params: { count: dropped } },
			];
		},
	};
}

/** `parent / child`, or `child` at the top. */
export function joinPath(parent: string, name: string): string {
	return parent ? `${parent} / ${name}` : name;
}

function capRows<T extends KeyValueRow>(
	rows: T[],
	max: number,
	warn: () => void,
): T[] {
	if (rows.length <= max) return rows;
	warn();
	return rows.slice(0, max);
}

/** Cuts the name and the tables to what a saved draft may hold. */
export function clampDraft(
	draft: ApiRequestDraft,
	ctx: ImportContext,
	path: string,
): ApiRequestDraft {
	const truncated = (max: number) => () => ctx.warn("TRUNCATED", path, { max });
	const script = (text: string): string => {
		if (text.length <= MAX_SCRIPT_LENGTH) return text;
		truncated(MAX_SCRIPT_LENGTH)();
		return "";
	};
	return {
		...draft,
		name: draft.name.slice(0, MAX_REQUEST_NAME_LENGTH),
		params: capRows(draft.params, MAX_TABLE_ROWS, truncated(MAX_TABLE_ROWS)),
		headers: capRows(draft.headers, MAX_HEADERS, truncated(MAX_HEADERS)),
		body: {
			...draft.body,
			urlencoded: capRows(
				draft.body.urlencoded,
				MAX_TABLE_ROWS,
				truncated(MAX_TABLE_ROWS),
			),
			formData: capRows(
				draft.body.formData,
				MAX_TABLE_ROWS,
				truncated(MAX_TABLE_ROWS),
			),
		},
		scripts: {
			pre: script(draft.scripts.pre),
			post: script(draft.scripts.post),
		},
	};
}

/** Warns when a script was written against the `pm.*` API. */
export function checkScriptApi(
	text: string,
	ctx: ImportContext,
	path: string,
): void {
	if (/\bpm\s*\.\s*[a-zA-Z]/.test(text)) ctx.warn("SCRIPT_REVIEW", path);
}
