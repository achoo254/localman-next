import { randomBytes } from "node:crypto";
import { OperationError } from "@localman/operations";
import {
	HOP_BY_HOP_HEADERS,
	isValidHeaderName,
	isValidHeaderValue,
} from "@localman/shared/api-client";
import { z } from "zod";
import { messagesFor } from "../../i18n/server-messages.js";
import type { SsrfGuard } from "../api-client/ssrf-guard.js";
import { CALLBACK_EVENTS } from "../mock-runtime/request-log-model.js";
import { isMockHost } from "../mock-runtime/upstream-config.js";
import { readUserLocale } from "../users/user-locale.js";
import { keepHiddenQuery, keepHiddenValues } from "./callback-headers.js";
import type { StoredCallback } from "./callback-model.js";
import { MAX_CALLBACK_BODY_BYTES } from "./callback-template.js";
import {
	type OutboundTarget,
	outboundTargetSchema,
} from "./outbound-target.js";

/** Callbacks one resource may have. */
export const MAX_CALLBACKS_PER_RESOURCE = 10;
export const MAX_CALLBACK_HEADERS = 20;
export const DEFAULT_BODY_TEMPLATE =
	'{"event":"{{event}}","resource":"{{resource}}","record":{{record}}}';

/** Set by the sender (framing, routing, Localman's own markers). */
const RESERVED_HEADERS = new Set([
	...HOP_BY_HOP_HEADERS,
	"host",
	"content-length",
]);

const headerInput = z.object({
	name: z
		.string()
		.min(1)
		.max(100)
		.refine(isValidHeaderName, "must be a header name")
		.refine((name) => {
			const lower = name.toLowerCase();
			return !RESERVED_HEADERS.has(lower) && !lower.startsWith("x-localman-");
		}, "is set by Localman"),
	value: z.string().max(2000).refine(isValidHeaderValue, "must be one line"),
});

export const callbackInputSchema = z.object({
	/** Keeps the last result of an existing callback; new ones get an id. */
	id: z
		.string()
		.regex(/^[A-Za-z0-9_-]{1,40}$/)
		.optional(),
	on: z.enum(CALLBACK_EVENTS),
	target: outboundTargetSchema,
	bodyTemplate: z
		.string()
		.refine(
			(text) => Buffer.byteLength(text) <= MAX_CALLBACK_BODY_BYTES,
			"must be at most 64 KB",
		)
		.default(DEFAULT_BODY_TEMPLATE),
	headers: z.array(headerInput).max(MAX_CALLBACK_HEADERS).default([]),
	enabled: z.boolean().default(true),
});
export type CallbackInput = z.infer<typeof callbackInputSchema>;

export const callbacksInputSchema = z
	.array(callbackInputSchema)
	.max(MAX_CALLBACKS_PER_RESOURCE)
	.refine((list) => {
		const ids = list.flatMap((callback) => (callback.id ? [callback.id] : []));
		return new Set(ids).size === ids.length;
	}, "ids must be unique");

/**
 * An https URL as sent: no credentials or fragment, not a Localman mock
 * (a callback into a mock would write records and fire callbacks again);
 * `null` otherwise. A query is kept (webhook URLs often carry a token).
 */
export function normalizeCallbackUrl(input: string): string | null {
	const value = input.trim();
	if (!URL.canParse(value) || value.includes("#")) return null;
	const url = new URL(value);
	const fine =
		url.protocol === "https:" &&
		url.username === "" &&
		url.password === "" &&
		url.hostname !== "" &&
		!isMockHost(url.hostname);
	return fine ? url.href : null;
}

/** 400 errors of a URL target, in the caller's language. */
async function urlError(
	sub: string,
	path: string,
	code: "VALIDATION_ERROR" | "CALLBACK_URL_BLOCKED" | "CALLBACK_DNS_FAILED",
): Promise<OperationError> {
	const texts = messagesFor(await readUserLocale(sub)).traffic;
	const message =
		code === "VALIDATION_ERROR"
			? texts.callbackUrlInvalid
			: code === "CALLBACK_URL_BLOCKED"
				? texts.callbackUrlBlocked
				: texts.callbackDns;
	return new OperationError(400, code, message, [{ path, message }]);
}

/**
 * The target as stored: a URL normalized and its host past the SSRF guard
 * (400 `VALIDATION_ERROR`, `CALLBACK_URL_BLOCKED`, `CALLBACK_DNS_FAILED`
 * at `path`). A tunnel's host is checked when sent.
 */
export async function checkedTarget(
	sub: string,
	path: string,
	target: OutboundTarget,
	guard: SsrfGuard,
): Promise<OutboundTarget> {
	if (target.kind === "tunnel") return target;
	const url = normalizeCallbackUrl(target.url);
	if (url === null) throw await urlError(sub, path, "VALIDATION_ERROR");
	try {
		await guard.pin(new URL(url));
	} catch (error) {
		if (!(error instanceof OperationError)) throw error;
		const dns = error.code === "PROXY_DNS_FAILED";
		throw await urlError(
			sub,
			path,
			dns ? "CALLBACK_DNS_FAILED" : "CALLBACK_URL_BLOCKED",
		);
	}
	return { kind: "url", url };
}

/**
 * A URL target sent back as shown (`…?[hidden]`) with the stored query of
 * the same callback (see `keepHiddenQuery`).
 */
function withHiddenQuery(
	target: OutboundTarget,
	before: StoredCallback | undefined,
): OutboundTarget {
	if (target.kind !== "url") return target;
	const stored = before?.target.kind === "url" ? before.target.url : null;
	return { kind: "url", url: keepHiddenQuery(target.url, stored) };
}

/**
 * The callbacks to store: targets checked, ids kept or minted, the last
 * result, the `[hidden]` header values and URL query of a callback whose
 * id survives kept with it.
 */
export async function toStoredCallbacks(
	sub: string,
	inputs: readonly CallbackInput[],
	previous: readonly StoredCallback[],
	guard: SsrfGuard,
): Promise<StoredCallback[]> {
	const stored: StoredCallback[] = [];
	for (const [index, input] of inputs.entries()) {
		const id = input.id ?? randomBytes(6).toString("hex");
		const before = previous.find((callback) => callback.id === id);
		stored.push({
			id,
			on: input.on,
			target: await checkedTarget(
				sub,
				`callbacks.${index}.target.url`,
				withHiddenQuery(input.target, before),
				guard,
			),
			bodyTemplate: input.bodyTemplate,
			headers: keepHiddenValues(input.headers, before?.headers ?? []),
			enabled: input.enabled,
			last: before?.last ?? null,
		});
	}
	return stored;
}
