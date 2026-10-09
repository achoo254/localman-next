/**
 * Body of an imported `curl` command. `-d` data becomes raw JSON, a
 * url-encoded table or raw text according to its Content-Type (curl's own
 * default is url-encoded); `-F` parts become form-data rows.
 */
import type {
	FormDataRow,
	HeaderEntry,
	KeyValueRow,
	RawLanguage,
	RequestBody,
} from "../request-model.js";
import { emptyRequestBody } from "../request-model.js";
import {
	IMPLIED_CONTENT_TYPES,
	URLENCODED_TYPE,
	isExactType,
	rawLanguageForType,
} from "./content-types.js";
import type { CurlFormPart } from "./curl-option-table.js";
import type { ImportContext } from "./import-context.js";

/** `a=1&b=two`: every piece has a key and `=`, no line breaks. */
const PAIRS = /^[^=&\r\n]+=[^&\r\n]*(&[^=&\r\n]+=[^&\r\n]*)*$/;

/** Removes headers named `lowerName` whose value passes `matches`. */
export function removeHeader(
	headers: HeaderEntry[],
	lowerName: string,
	matches: (value: string) => boolean = () => true,
): void {
	for (let i = headers.length - 1; i >= 0; i -= 1) {
		const header = headers[i];
		const sameName = header.name.toLowerCase() === lowerName;
		if (sameName && matches(header.value)) headers.splice(i, 1);
	}
}

function looksLikeJson(text: string): boolean {
	const trimmed = text.trim();
	if (!/^[[{]/.test(trimmed)) return false;
	try {
		JSON.parse(trimmed);
		return true;
	} catch {
		return false;
	}
}

function rawBody(
	raw: string,
	rawLanguage: RawLanguage,
	headers: HeaderEntry[],
): RequestBody {
	removeHeader(headers, "content-type", (value) =>
		isExactType(value, IMPLIED_CONTENT_TYPES[rawLanguage]),
	);
	return { ...emptyRequestBody(), type: "raw", rawLanguage, raw };
}

export function bodyFromData(
	data: string,
	headers: HeaderEntry[],
	ctx: ImportContext,
): RequestBody {
	const contentType =
		[...headers].reverse().find((h) => h.name.toLowerCase() === "content-type")
			?.value ?? null;
	if (contentType ? /json/i.test(contentType) : looksLikeJson(data)) {
		return rawBody(data, "json", headers);
	}
	const formType =
		contentType === null ||
		contentType.toLowerCase().startsWith(URLENCODED_TYPE);
	if (formType && PAIRS.test(data)) {
		removeHeader(headers, "content-type", (value) =>
			isExactType(value, URLENCODED_TYPE),
		);
		const urlencoded: KeyValueRow[] = [];
		new URLSearchParams(data).forEach((value, key) => {
			urlencoded.push({ id: ctx.newId(), key, value, enabled: true });
		});
		return { ...emptyRequestBody(), type: "urlencoded", urlencoded };
	}
	if (contentType === null)
		headers.push({ name: "Content-Type", value: URLENCODED_TYPE });
	const language = contentType ? rawLanguageForType(contentType) : "text";
	return rawBody(data, language, headers);
}

export function formDataRows(
	parts: readonly CurlFormPart[],
	ctx: ImportContext,
): FormDataRow[] {
	return parts.map((part) => ({
		id: ctx.newId(),
		key: part.name,
		value: part.value,
		enabled: true,
		kind: part.fileName === null ? "text" : "file",
	}));
}
