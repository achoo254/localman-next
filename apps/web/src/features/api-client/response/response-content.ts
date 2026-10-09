/**
 * What the response viewer needs to know about a body: its media type,
 * whether it is text, its bytes for saving, and a file name. Pure, so the
 * components stay small and these rules are tested on their own.
 */
import {
	type ClientResponse,
	base64ToBytes,
	utf8Encode,
} from "@localman/shared/api-client";
import type { BadgeTone } from "../../../components/ui/badge";

/** How the Preview mode can show a body. */
export type PreviewKind = "html" | "image" | "json" | "none";

/** Media type of the response (`text/html`), lower-case, without params. */
export function mediaTypeOf(response: Pick<ClientResponse, "headers">): string {
	const header = response.headers.find(
		(entry) => entry.name.toLowerCase() === "content-type",
	);
	return (header?.value.split(";")[0] ?? "").trim().toLowerCase();
}

/** The body did not decode as UTF-8 and arrived as base64. */
export function isBinaryBody(response: ClientResponse): boolean {
	return response.bodyEncoding === "base64";
}

/** `isJson`: the body parsed as JSON (the caller already tried, once). */
export function previewKindOf(
	response: ClientResponse,
	isJson: boolean,
): PreviewKind {
	const media = mediaTypeOf(response);
	if (media.startsWith("image/")) return "image";
	if (isBinaryBody(response)) return "none";
	if (media === "text/html" || media === "application/xhtml+xml") {
		return "html";
	}
	return isJson ? "json" : "none";
}

/** The body's bytes, as the target sent them (after decompression). */
export function bodyBytes(response: ClientResponse): Uint8Array {
	return isBinaryBody(response)
		? base64ToBytes(response.body)
		: utf8Encode(response.body);
}

/** Bodies above this are shown without colours (spans cost memory). */
export const MAX_HIGHLIGHT_CHARS = 200_000;

/** Indented JSON, or `null` when the body is not JSON. */
export function prettyJson(body: string): string | null {
	if (body.trim() === "") return null;
	try {
		return JSON.stringify(JSON.parse(body), null, 2);
	} catch {
		return null;
	}
}

const EXTENSIONS: Readonly<Record<string, string>> = {
	"application/json": "json",
	"application/xml": "xml",
	"text/xml": "xml",
	"text/html": "html",
	"text/plain": "txt",
	"text/csv": "csv",
	"application/pdf": "pdf",
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/svg+xml": "svg",
};

/** `users.json` from the last path segment and the media type. */
export function bodyFileName(response: ClientResponse): string {
	const media = mediaTypeOf(response);
	const extension =
		EXTENSIONS[media] ?? (media.endsWith("+json") ? "json" : "bin");
	let base = "response";
	try {
		const segment = new URL(response.finalUrl).pathname
			.split("/")
			.filter(Boolean)
			.pop();
		if (segment) base = decodeURIComponent(segment);
	} catch {
		// Keep "response": the URL is only a naming hint.
	}
	const safe = base.replace(/[^\w.-]+/g, "-").slice(0, 80) || "response";
	return /\.\w{1,5}$/.test(safe) ? safe : `${safe}.${extension}`;
}

/** Badge tone of an HTTP status: 2xx success … 5xx danger. */
export function statusTone(status: number): BadgeTone {
	if (status >= 200 && status < 300) return "success";
	if (status >= 300 && status < 400) return "info";
	if (status >= 400 && status < 500) return "warning";
	if (status >= 500 && status < 600) return "danger";
	return "neutral";
}

/** `312 B`, `1.2 KB`, `3.4 MB`, numbers in the language on screen. */
export function formatBytes(
	bytes: number,
	formatNumber: (value: number) => string,
): string {
	if (bytes < 1024) return `${formatNumber(bytes)} B`;
	const units = ["KB", "MB", "GB"] as const;
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${formatNumber(Math.round(value * 10) / 10)} ${units[unit]}`;
}
