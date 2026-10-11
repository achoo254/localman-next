/**
 * State shared by one import run: id source, warnings (capped, tagged with
 * the item path) and the item budget. Fitting values to the server limits
 * is in `clamp-draft.ts` and `fit-tree.ts`.
 */
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

/** Warns when a script was written against the `pm.*` API. */
export function checkScriptApi(
	text: string,
	ctx: ImportContext,
	path: string,
): void {
	if (/\bpm\s*\.\s*[a-zA-Z]/.test(text)) ctx.warn("SCRIPT_REVIEW", path);
}
