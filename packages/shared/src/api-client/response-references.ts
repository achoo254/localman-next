/**
 * `{{response "<request>" "<JSONPath>" [<ttl seconds>]}}`: a value taken
 * from the last response of another request of the same collection, so
 * requests chain without scripts (log in once, use its token elsewhere).
 * A response older than its TTL (default 300 s) is fetched again by
 * sending that request first. Pure: the caller looks requests up, keeps
 * responses and sends.
 */
import { parseJsonPath, readJsonPath } from "../json-path.js";
import type { ClientResponse } from "./response-model.js";
import { VARIABLE_PATTERN } from "./variable-interpolation.js";

export const RESPONSE_REFERENCE_TTL_DEFAULT_S = 300;
export const RESPONSE_REFERENCE_TTL_MAX_S = 86_400;
/** Requests one send may chain through (the request itself excluded). */
export const RESPONSE_REFERENCE_DEPTH_MAX = 5;

export interface ResponseReference {
	/** The text between the braces: the variable name it fills. */
	readonly expression: string;
	readonly requestName: string;
	readonly path: string;
	readonly ttlSeconds: number;
}

// response "<name>" "<path>" [ttl], quotes may be " or '.
const REFERENCE =
	/^\s*response\s+("([^"]+)"|'([^']+)')\s+("([^"]+)"|'([^']+)')(?:\s+(\d{1,6}))?\s*$/;

/** `null` when the expression is not a response reference. */
export function parseResponseReference(
	expression: string,
): ResponseReference | null {
	const match = REFERENCE.exec(expression);
	if (!match) return null;
	const requestName = (match[2] ?? match[3] ?? "").trim();
	const path = (match[5] ?? match[6] ?? "").trim();
	const ttl =
		match[7] === undefined
			? RESPONSE_REFERENCE_TTL_DEFAULT_S
			: Number(match[7]);
	if (requestName === "" || path === "") return null;
	return {
		expression,
		requestName,
		path,
		ttlSeconds: Math.min(ttl, RESPONSE_REFERENCE_TTL_MAX_S),
	};
}

/** Every response reference in `texts`, each expression once, in order. */
export function findResponseReferences(
	texts: readonly string[],
): ResponseReference[] {
	const found = new Map<string, ResponseReference>();
	for (const text of texts) {
		for (const match of text.matchAll(VARIABLE_PATTERN)) {
			const expression = match[1] ?? "";
			if (found.has(expression)) continue;
			const reference = parseResponseReference(expression);
			if (reference) found.set(expression, reference);
		}
	}
	return [...found.values()];
}

export type ReferenceFailureCode =
	| "REFERENCE_REQUEST_NOT_FOUND"
	| "REFERENCE_LOOP"
	| "REFERENCE_TOO_DEEP"
	| "REFERENCE_SEND_FAILED"
	| "REFERENCE_NOT_JSON"
	| "REFERENCE_PATH_INVALID"
	| "REFERENCE_PATH_MISSING";

export class ResponseReferenceError extends Error {
	constructor(
		readonly code: ReferenceFailureCode,
		readonly reference: ResponseReference,
	) {
		super(`${code}: ${reference.expression}`);
		this.name = "ResponseReferenceError";
	}
}

/** A response kept with when it arrived. */
export interface KeptResponse {
	readonly response: ClientResponse;
	readonly at: number;
}

export function isFresh(
	kept: KeptResponse | undefined,
	ttlSeconds: number,
	now: number,
): kept is KeptResponse {
	return kept !== undefined && now - kept.at < ttlSeconds * 1000;
}

/**
 * The value a reference stands for in `response`: the JSON body read at
 * its path, as text (strings as they are, other values as JSON).
 */
export function valueOfReference(
	reference: ResponseReference,
	response: ClientResponse,
): string {
	const steps = parseJsonPath(reference.path);
	if (!steps)
		throw new ResponseReferenceError("REFERENCE_PATH_INVALID", reference);
	if (response.bodyEncoding !== "utf8") {
		throw new ResponseReferenceError("REFERENCE_NOT_JSON", reference);
	}
	let body: unknown;
	try {
		body = JSON.parse(response.body);
	} catch {
		throw new ResponseReferenceError("REFERENCE_NOT_JSON", reference);
	}
	const value = readJsonPath(body, steps);
	if (value === undefined) {
		throw new ResponseReferenceError("REFERENCE_PATH_MISSING", reference);
	}
	return typeof value === "string" ? value : JSON.stringify(value);
}

/** What resolving needs from the API client. */
export interface ReferenceSources<R> {
	/** The request of that name in the collection, or `null`. */
	find(name: string): Promise<R | null>;
	/** A stable id of the request (loops are detected on it). */
	idOf(request: R): string;
	/** Its last response, if kept. */
	kept(request: R): KeptResponse | undefined;
	/**
	 * Sends it (its own references already resolved by the caller through
	 * `resolveResponseReferences` with `chain`); rejects when it fails.
	 */
	send(request: R, chain: readonly string[]): Promise<ClientResponse>;
	now(): number;
}

/**
 * Values of the references, by expression: from a kept response within
 * its TTL, else by sending the request first. `chain` holds the ids of
 * the requests being sent around this one, so a request that needs
 * itself (directly or through others) fails as a loop.
 */
export async function resolveResponseReferences<R>(
	references: readonly ResponseReference[],
	sources: ReferenceSources<R>,
	chain: readonly string[] = [],
): Promise<Map<string, string>> {
	const values = new Map<string, string>();
	for (const reference of references) {
		const request = await sources.find(reference.requestName);
		if (request === null) {
			throw new ResponseReferenceError(
				"REFERENCE_REQUEST_NOT_FOUND",
				reference,
			);
		}
		const id = sources.idOf(request);
		if (chain.includes(id)) {
			throw new ResponseReferenceError("REFERENCE_LOOP", reference);
		}
		let kept = sources.kept(request);
		if (!isFresh(kept, reference.ttlSeconds, sources.now())) {
			if (chain.length >= RESPONSE_REFERENCE_DEPTH_MAX) {
				throw new ResponseReferenceError("REFERENCE_TOO_DEEP", reference);
			}
			try {
				const response = await sources.send(request, [...chain, id]);
				kept = { response, at: sources.now() };
			} catch (error) {
				if (error instanceof ResponseReferenceError) throw error;
				throw new ResponseReferenceError("REFERENCE_SEND_FAILED", reference);
			}
		}
		values.set(
			reference.expression,
			valueOfReference(reference, kept.response),
		);
	}
	return values;
}
