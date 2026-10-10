/** Draft and checks of the inbox form, the same rules as the API. */
import type { Translate } from "../../i18n/translate";
import type { InboxResponse, InboxView } from "./inbox-api";

/**
 * What an inbox may answer with, as the API allows: JSON or plain text,
 * never HTML or script (the answer is served on the mock origin).
 */
export const CONTENT_TYPES = ["application/json", "text/plain"] as const;
export const DEFAULT_BODY = '{"received":true}';
export const MAX_NAME = 32;
/** Lowercase letters, digits and `-`, not at either end. */
export const INBOX_NAME = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
/** An informational status cannot end an HTTP exchange. */
export const MIN_STATUS = 200;
export const MAX_STATUS = 599;
const TUNNEL_PATH = /^\/[^\s?#]*$/;

export interface InboxDraft {
	name: string;
	/** As typed. */
	status: string;
	contentType: string;
	body: string;
	forward: boolean;
	port: string;
	path: string;
}

export type InboxField = "name" | "status" | "body" | "port" | "path";
export type InboxErrors = Partial<Record<InboxField, string>>;

export interface InboxValue {
	name: string;
	response: InboxResponse;
	forward: { port: number; path: string } | null;
}

/** One of `CONTENT_TYPES` for a stored type (`…+json`, a charset). */
export function contentTypeChoice(contentType: string): string {
	return bodyLanguage(contentType) === "json"
		? "application/json"
		: "text/plain";
}

export function draftOfInbox(inbox: InboxView | null): InboxDraft {
	return {
		name: inbox?.name ?? "",
		status: String(inbox?.response.status ?? 200),
		contentType: contentTypeChoice(
			inbox?.response.contentType ?? "application/json",
		),
		body: inbox?.response.body ?? DEFAULT_BODY,
		forward: Boolean(inbox?.forward),
		port: String(inbox?.forward?.port ?? 3000),
		path: inbox?.forward?.path ?? "/webhooks",
	};
}

/** A whole number in `[min, max]`, else null. */
export function wholeIn(text: string, min: number, max: number): number | null {
	const value = text.trim() === "" ? Number.NaN : Number(text);
	return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** CodeMirror grammar of a content type. */
export function bodyLanguage(contentType: string): "json" | "text" {
	return /json/i.test(contentType) ? "json" : "text";
}

function isJson(text: string): boolean {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

/** Errors by field, and the value to send when there are none. */
export function checkInbox(
	draft: InboxDraft,
	t: Translate,
): { errors: InboxErrors; value: InboxValue | null } {
	const errors: InboxErrors = {};
	const name = draft.name.trim();
	if (name === "") errors.name = t("webhookInbox.form.errors.nameEmpty");
	else if (!INBOX_NAME.test(name)) {
		errors.name = t("webhookInbox.form.errors.nameFormat");
	}
	const status = wholeIn(draft.status, MIN_STATUS, MAX_STATUS);
	if (status === null) errors.status = t("webhookInbox.form.errors.status");
	if (bodyLanguage(draft.contentType) === "json" && !isJson(draft.body)) {
		errors.body = t("webhookInbox.form.errors.bodyJson");
	}
	const port = wholeIn(draft.port, 1, 65_535);
	if (draft.forward) {
		if (port === null) errors.port = t("webhookInbox.form.errors.port");
		if (!TUNNEL_PATH.test(draft.path)) {
			errors.path = t("webhookInbox.form.errors.path");
		}
	}
	if (Object.keys(errors).length > 0 || status === null) {
		return { errors, value: null };
	}
	return {
		errors,
		value: {
			name,
			response: {
				status,
				contentType: contentTypeChoice(draft.contentType),
				body: draft.body,
			},
			forward:
				draft.forward && port !== null ? { port, path: draft.path } : null,
		},
	};
}

export function sameResponse(a: InboxResponse, b: InboxResponse): boolean {
	return (
		a.status === b.status &&
		a.contentType === b.contentType &&
		a.body === b.body
	);
}

export function sameForward(
	a: { port: number; path: string } | null,
	b: { port: number; path: string } | null,
): boolean {
	if (a === null || b === null) return a === b;
	return a.port === b.port && a.path === b.path;
}
