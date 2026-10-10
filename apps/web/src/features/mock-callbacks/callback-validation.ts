/**
 * Checks of the callbacks editor, the same rules as the API, and the
 * placement of the API's own 400 errors (`details[].path` such as
 * `callbacks.2.target.url`) on the right block.
 */
import {
	HOP_BY_HOP_HEADERS,
	isValidHeaderName,
	isValidHeaderValue,
} from "@localman/shared/api-client";
import type { Translate } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";
import {
	type CallbackDraft,
	filledHeaders,
	inputOf,
	parseTargetText,
} from "./callback-draft";
import type { CallbackInput } from "./callbacks-api";

export const MAX_CALLBACK_HEADERS = 20;

export interface CallbackErrors {
	target?: string;
	body?: string;
	/** The whole header group (too many, or an API refusal). */
	headers?: string;
	/** By header row key. */
	headerRows?: Record<string, string>;
}

/** By callback key; only blocks with an error appear. */
export type EditorErrors = Record<string, CallbackErrors>;

const RESERVED = new Set([...HOP_BY_HOP_HEADERS, "host", "content-length"]);
const VARIABLE = /\{\{\s*(record(?:\.[A-Za-z0-9_$-]+)*|event|resource)\s*\}\}/g;

/** The template filled like the server does, with a sample record. */
export function sampleBody(template: string, resource: string): string {
	return template.replace(VARIABLE, (_match, name: string) => {
		if (name === "event") return "create";
		if (name === "resource") return resource;
		if (name === "record") return '{"id":"1"}';
		return "1";
	});
}

function bodyError(template: string, t: Translate): string | undefined {
	try {
		JSON.parse(sampleBody(template, "items"));
		return undefined;
	} catch {
		return t("mockCallbacks.errors.body", { record: "{{record}}" });
	}
}

function headerError(name: string, value: string, t: Translate) {
	const lower = name.trim().toLowerCase();
	if (lower === "" || !isValidHeaderName(lower)) {
		return t("mockCallbacks.errors.headerName");
	}
	if (RESERVED.has(lower) || lower.startsWith("x-localman-")) {
		return t("mockCallbacks.errors.headerReserved", { name: name.trim() });
	}
	return isValidHeaderValue(value)
		? undefined
		: t("mockCallbacks.errors.headerValue");
}

/** Checks one draft (Send test, Save); `input` only when it is valid. */
export function checkDraft(
	draft: CallbackDraft,
	t: Translate,
): { errors: CallbackErrors; input: CallbackInput | null } {
	const errors: CallbackErrors = {};
	const parsed = parseTargetText(draft.target);
	if (!parsed.ok) {
		errors.target = {
			empty: t("mockCallbacks.errors.targetEmpty"),
			http: t("mockCallbacks.errors.targetHttp"),
			format: t("mockCallbacks.errors.targetFormat"),
			port: t("mockCallbacks.errors.targetPort"),
		}[parsed.reason];
	}
	errors.body = bodyError(draft.bodyTemplate, t);
	const headers = filledHeaders(draft);
	if (headers.length > MAX_CALLBACK_HEADERS) {
		errors.headers = t("mockCallbacks.errors.headerMax", {
			max: MAX_CALLBACK_HEADERS,
		});
	}
	const rows: Record<string, string> = {};
	for (const header of headers) {
		// A hidden value left alone is the stored one, valid by definition.
		const value = header.hidden && header.value === "" ? "" : header.value;
		const message = headerError(header.name, value, t);
		if (message) rows[header.key] = message;
	}
	if (Object.keys(rows).length > 0) errors.headerRows = rows;
	const input = parsed.ok ? inputOf(draft, parsed.target) : null;
	const clean = Object.values(errors).every((value) => value === undefined);
	return { errors, input: clean ? input : null };
}

export function checkDrafts(
	drafts: readonly CallbackDraft[],
	t: Translate,
): { errors: EditorErrors; inputs: CallbackInput[] | null } {
	const errors: EditorErrors = {};
	const inputs: CallbackInput[] = [];
	for (const draft of drafts) {
		const result = checkDraft(draft, t);
		if (result.input) inputs.push(result.input);
		else errors[draft.key] = result.errors;
	}
	return { errors, inputs: inputs.length === drafts.length ? inputs : null };
}

const DETAIL_PATH = /^callbacks?\.(?:(\d+)\.)?(target|bodyTemplate|headers)/;

/**
 * The API's 400 details placed on their blocks; `null` when the error has
 * none it can place (shown as a general error instead). `single` is the
 * draft of a test (`callback.target.url`).
 */
export function serverErrors(
	error: unknown,
	drafts: readonly CallbackDraft[],
	t: Translate,
	single?: CallbackDraft,
): EditorErrors | null {
	if (!(error instanceof ApiError) || error.status !== 400) return null;
	if (!Array.isArray(error.details)) return null;
	const placed: EditorErrors = {};
	for (const detail of error.details) {
		if (!isRecord(detail) || typeof detail.path !== "string") continue;
		const match = DETAIL_PATH.exec(detail.path);
		if (!match) continue;
		const draft = match[1] === undefined ? single : drafts[Number(match[1])];
		if (!draft) continue;
		const own = placed[draft.key] ?? {};
		const message =
			typeof detail.message === "string" && detail.message !== ""
				? detail.message
				: error.message;
		if (match[2] === "target") own.target = message;
		else if (match[2] === "bodyTemplate") {
			own.body = t("mockCallbacks.errors.bodyTooLarge");
		} else own.headers = t("mockCallbacks.errors.headersRefused");
		placed[draft.key] = own;
	}
	return Object.keys(placed).length > 0 ? placed : null;
}
