import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	isRecord,
	optionalString,
} from "../../lib/json-guards";
import { type Delivery, parseDelivery } from "./delivery";

export const CALLBACK_EVENTS = ["create", "update", "delete"] as const;
export type CallbackEvent = (typeof CALLBACK_EVENTS)[number];

/** An https URL, or the owner's tunnel of `localhost:<port>` plus a path. */
export type CallbackTarget =
	| { kind: "url"; url: string }
	| { kind: "tunnel"; port: number; path: string };

/** A header whose value the server keeps secret answers this value. */
export const HIDDEN_VALUE = "[hidden]";

export interface CallbackHeader {
	name: string;
	value: string;
	/** The value is `[hidden]`; sending it back keeps the stored one. */
	hidden: boolean;
}

export interface CallbackView {
	id: string;
	on: CallbackEvent;
	target: CallbackTarget;
	/** `https://…` or `tunnel:<port><path>`. */
	targetLabel: string;
	bodyTemplate: string;
	headers: CallbackHeader[];
	enabled: boolean;
	last: Delivery | null;
}

/** `GET …/resources/:resourceId/callbacks`. */
export interface ResourceCallbacks {
	callbacks: CallbackView[];
	max: number;
	defaultBodyTemplate: string;
	/** The caller may change them and send tests (owner only). */
	canManage: boolean;
}

/** What `PUT` and `POST …/test` take for one callback. */
export interface CallbackInput {
	id?: string;
	on: CallbackEvent;
	target: CallbackTarget;
	bodyTemplate: string;
	headers: { name: string; value: string }[];
	enabled: boolean;
}

/** `POST …/callbacks/test`: the delivery and the last answer, if any. */
export interface CallbackTestResult {
	target: string;
	delivery: Delivery;
	/** `body` is null for a binary answer. */
	response: { status: number; body: string | null; truncated: boolean } | null;
}

export const callbacksKey = (projectId: string, resourceId: string) =>
	["resource-callbacks", projectId, resourceId] as const;

const callbacksPath = (projectId: string, resourceId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/callbacks`;

function isEvent(value: string): value is CallbackEvent {
	return CALLBACK_EVENTS.some((event) => event === value);
}

function parseTarget(value: unknown): CallbackTarget {
	const data = expectRecord(value, "target");
	const kind = expectString(data, "kind");
	if (kind === "url") return { kind, url: expectString(data, "url") };
	if (kind === "tunnel") {
		return {
			kind,
			port: expectNumber(data, "port"),
			path: expectString(data, "path"),
		};
	}
	throw new InvalidResponseError(`target kind "${kind}"`);
}

function parseHeader(value: unknown): CallbackHeader {
	const data = expectRecord(value, "header");
	return {
		name: expectString(data, "name"),
		value: expectString(data, "value"),
		hidden: data.hidden === true,
	};
}

function parseCallback(value: unknown): CallbackView {
	const data = expectRecord(value, "callback");
	const on = expectString(data, "on");
	if (!isEvent(on)) throw new InvalidResponseError(`event "${on}"`);
	return {
		id: expectString(data, "id"),
		on,
		target: parseTarget(data.target),
		targetLabel: expectString(data, "targetLabel"),
		bodyTemplate: expectString(data, "bodyTemplate"),
		headers: expectArray(data, "headers").map(parseHeader),
		enabled: expectBoolean(data, "enabled"),
		last: parseDelivery(data.last),
	};
}

export function parseResourceCallbacks(value: unknown): ResourceCallbacks {
	const data = expectRecord(value, "callbacks");
	return {
		callbacks: expectArray(data, "callbacks").map(parseCallback),
		max: expectNumber(data, "max"),
		defaultBodyTemplate: expectString(data, "defaultBodyTemplate"),
		canManage: expectBoolean(data, "canManage"),
	};
}

export async function fetchCallbacks(
	projectId: string,
	resourceId: string,
): Promise<ResourceCallbacks> {
	return parseResourceCallbacks(
		await apiRequest(callbacksPath(projectId, resourceId)),
	);
}

/** Owner only; replaces every callback of the resource. */
export async function saveCallbacks(
	projectId: string,
	resourceId: string,
	callbacks: readonly CallbackInput[],
): Promise<ResourceCallbacks> {
	return parseResourceCallbacks(
		await apiRequest(callbacksPath(projectId, resourceId), {
			method: "PUT",
			body: { callbacks },
		}),
	);
}

/** Owner only; sends the draft now with the resource's first record. */
export async function testCallback(
	projectId: string,
	resourceId: string,
	callback: CallbackInput,
): Promise<CallbackTestResult> {
	const data = expectRecord(
		await apiRequest(`${callbacksPath(projectId, resourceId)}/test`, {
			method: "POST",
			body: { callback },
		}),
		"callback test",
	);
	const delivery = parseDelivery(data.delivery);
	if (delivery === null) throw new InvalidResponseError("delivery");
	const response = isRecord(data.response) ? data.response : null;
	return {
		target: optionalString(data, "target") ?? "",
		delivery,
		response: response
			? {
					status: expectNumber(response, "status"),
					// A binary answer is not worth showing as text.
					body:
						response.bodyEncoding === "base64"
							? null
							: expectString(response, "body"),
					truncated: response.truncated === true,
				}
			: null,
	};
}
