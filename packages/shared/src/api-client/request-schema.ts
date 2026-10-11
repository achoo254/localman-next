/**
 * zod schema of a request draft, for every place a draft crosses into the
 * server: saved tabs (`client_drafts`), history entries and imports.
 * Typed against `ApiRequestDraft`, so model and schema cannot drift.
 */
import { z } from "zod";
import {
	MAX_HEADERS,
	MAX_HEADER_NAME_LENGTH,
	MAX_HEADER_VALUE_LENGTH,
	MAX_REQUEST_BODY_BYTES,
	MAX_REQUEST_NAME_LENGTH,
	MAX_ROW_KEY_LENGTH,
	MAX_ROW_VALUE_LENGTH,
	MAX_SCRIPT_LENGTH,
	MAX_TABLE_ROWS,
	MAX_TIMEOUT_MS,
	MAX_URL_LENGTH,
	MIN_TIMEOUT_MS,
} from "./limits.js";
import {
	API_KEY_LOCATIONS,
	type ApiRequestDraft,
	BODY_TYPES,
	type EffectiveAuth,
	HTTP_METHODS,
	RAW_LANGUAGES,
	ROUTE_MODES,
	type RequestAuth,
	type RequestScripts,
} from "./request-model.js";

const rowId = z.string().min(1).max(64);
const rowKey = z.string().max(MAX_ROW_KEY_LENGTH);
const rowValue = z.string().max(MAX_ROW_VALUE_LENGTH);
const secretText = z.string().max(MAX_HEADER_VALUE_LENGTH);

const keyValueRowSchema = z.object({
	id: rowId,
	key: rowKey,
	value: rowValue,
	enabled: z.boolean(),
	description: z.string().max(MAX_ROW_KEY_LENGTH).optional(),
});

const fileRefSchema = z.object({
	fileId: rowId,
	name: z.string().max(MAX_ROW_KEY_LENGTH),
	contentType: z.string().max(MAX_HEADER_NAME_LENGTH),
	size: z.number().int().min(0),
});

const formDataRowSchema = keyValueRowSchema.extend({
	kind: z.enum(["text", "file"]),
	file: fileRefSchema.optional(),
});

const noAuthSchema = z.object({ type: z.literal("none") });
const bearerAuthSchema = z.object({
	type: z.literal("bearer"),
	token: secretText,
});
const basicAuthSchema = z.object({
	type: z.literal("basic"),
	username: rowKey,
	password: secretText,
});
const apiKeyAuthSchema = z.object({
	type: z.literal("apikey"),
	key: z.string().max(MAX_HEADER_NAME_LENGTH),
	value: secretText,
	in: z.enum(API_KEY_LOCATIONS),
});

/** Pre-request and post-response scripts of a request, folder or collection. */
export const requestScriptsSchema: z.ZodType<RequestScripts> = z.object({
	pre: z.string().max(MAX_SCRIPT_LENGTH),
	post: z.string().max(MAX_SCRIPT_LENGTH),
});

/** Auth that does not inherit: what a collection root holds. */
export const effectiveAuthSchema: z.ZodType<EffectiveAuth> =
	z.discriminatedUnion("type", [
		noAuthSchema,
		bearerAuthSchema,
		basicAuthSchema,
		apiKeyAuthSchema,
	]);

export const requestAuthSchema: z.ZodType<RequestAuth> = z.discriminatedUnion(
	"type",
	[
		z.object({ type: z.literal("inherit") }),
		noAuthSchema,
		bearerAuthSchema,
		basicAuthSchema,
		apiKeyAuthSchema,
	],
);

const requestBodySchema = z.object({
	type: z.enum(BODY_TYPES),
	rawLanguage: z.enum(RAW_LANGUAGES),
	raw: z.string().max(MAX_REQUEST_BODY_BYTES),
	urlencoded: z.array(keyValueRowSchema).max(MAX_TABLE_ROWS),
	formData: z.array(formDataRowSchema).max(MAX_TABLE_ROWS),
	binary: fileRefSchema.nullable(),
});

export const apiRequestDraftSchema: z.ZodType<ApiRequestDraft> = z.object({
	name: z.string().max(MAX_REQUEST_NAME_LENGTH),
	method: z.enum(HTTP_METHODS),
	url: z.string().max(MAX_URL_LENGTH),
	params: z.array(keyValueRowSchema).max(MAX_TABLE_ROWS),
	headers: z.array(keyValueRowSchema).max(MAX_HEADERS),
	auth: requestAuthSchema,
	body: requestBodySchema,
	scripts: requestScriptsSchema,
	settings: z.object({
		followRedirects: z.boolean(),
		timeoutMs: z.number().int().min(MIN_TIMEOUT_MS).max(MAX_TIMEOUT_MS),
		sendClientIp: z.boolean(),
		route: z.enum(ROUTE_MODES),
	}),
});
