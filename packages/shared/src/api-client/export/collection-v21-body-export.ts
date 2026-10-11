/**
 * Key/value rows and the body of an exported v2.1 request. `mode` is the
 * kind that is sent; the other kinds are written too when they hold
 * something, as a Localman draft keeps them across type switches. A body
 * of type `none` that still holds content is written `disabled` with no
 * `mode`. Picked files are written by name only (`src`), never their bytes.
 */
import type {
	CollectionV21Body,
	CollectionV21KeyValue,
} from "../import/collection-v21-types.js";
import {
	type KeyValueRow,
	type RequestBody,
	emptyRequestBody,
} from "../request-model.js";

export function rowToV21(row: KeyValueRow): CollectionV21KeyValue {
	const out: CollectionV21KeyValue = { key: row.key, value: row.value };
	if (!row.enabled) out.disabled = true;
	if (row.description) out.description = row.description;
	return out;
}

export const rowsToV21 = (
	rows: readonly KeyValueRow[],
): CollectionV21KeyValue[] => rows.map(rowToV21);

const MODES = {
	raw: "raw",
	urlencoded: "urlencoded",
	formdata: "formdata",
	binary: "file",
} as const;

export function bodyToV21(body: RequestBody): CollectionV21Body | undefined {
	const out: CollectionV21Body = {};
	if (body.type !== "none") out.mode = MODES[body.type];
	const defaultLanguage = emptyRequestBody().rawLanguage;
	if (body.type === "raw" || body.raw || body.rawLanguage !== defaultLanguage) {
		out.raw = body.raw;
		out.options = { raw: { language: body.rawLanguage } };
	}
	if (body.type === "urlencoded" || body.urlencoded.length > 0) {
		out.urlencoded = rowsToV21(body.urlencoded);
	}
	if (body.type === "formdata" || body.formData.length > 0) {
		out.formdata = body.formData.map((row) =>
			row.kind === "text"
				? { ...rowToV21(row), type: "text" }
				: {
						...rowToV21(row),
						value: "",
						type: "file",
						src: row.file?.name ?? "",
					},
		);
	}
	if (body.type === "binary") out.file = { src: body.binary?.name ?? "" };
	if (Object.keys(out).length === 0) return undefined;
	if (body.type === "none") out.disabled = true;
	return out;
}
