/**
 * Raw body languages and media types, as importers and exporters see them.
 * `IMPLIED_CONTENT_TYPES` mirrors what the request preparer adds when the
 * user sets no Content-Type, so a header equal to it is left out on import.
 */
import type { RawLanguage } from "../request-model.js";

export const IMPLIED_CONTENT_TYPES: Readonly<Record<RawLanguage, string>> = {
	json: "application/json",
	text: "text/plain",
	xml: "application/xml",
	html: "text/html",
	javascript: "application/javascript",
};

export const URLENCODED_TYPE = "application/x-www-form-urlencoded";
export const MULTIPART_TYPE = "multipart/form-data";

/** `application/vnd.api+json` is JSON, `text/xml` is XML… else text. */
export function rawLanguageForType(contentType: string): RawLanguage {
	if (/json/i.test(contentType)) return "json";
	if (/xml/i.test(contentType)) return "xml";
	if (/html/i.test(contentType)) return "html";
	return /javascript|ecmascript/i.test(contentType) ? "javascript" : "text";
}

/** The media type alone, lower case: `text/plain; charset=utf-8` → `text/plain`. */
export function mediaTypeOf(contentType: string): string {
	return (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();
}

/** `true` when `contentType` is exactly `type` (no parameters), any case. */
export function isExactType(contentType: string, type: string): boolean {
	return contentType.trim().toLowerCase() === type;
}
