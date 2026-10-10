import { ApiError, apiRequest } from "../../lib/api-client";
import {
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	isRecord,
} from "../../lib/json-guards";
import { type Delivery, parseDelivery } from "../mock-callbacks/delivery";

/** The answer every sender of an inbox gets. */
export interface InboxResponse {
	status: number;
	contentType: string;
	body: string;
}

/** Where an inbox forwards: the owner's tunnel of `localhost:<port>`. */
export interface InboxForward {
	port: number;
	path: string;
	/** `tunnel:<port><path>`. */
	target: string;
}

export interface InboxView {
	id: string;
	name: string;
	/** Public URL senders post to: `{mock base}/_inbox/<name>`. */
	url: string;
	response: InboxResponse;
	forward: InboxForward | null;
	lastForward: Delivery | null;
	/** Requests of this inbox still in the request log. */
	requestCount: number;
	createdAt: string;
}

/** `GET /projects/:projectId/inboxes`. */
export interface ProjectInboxes {
	items: InboxView[];
	used: number;
	max: number;
	/** The caller may create, change and delete them (owner only). */
	canManage: boolean;
}

export const inboxesKey = (projectId: string) =>
	["webhook-inboxes", projectId] as const;

const inboxesPath = (projectId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/inboxes`;
const inboxPath = (projectId: string, name: string) =>
	`${inboxesPath(projectId)}/${encodeURIComponent(name)}`;

function parseInbox(value: unknown): InboxView {
	const data = expectRecord(value, "inbox");
	const response = expectRecord(data.response, "inbox response");
	const forward = isRecord(data.forward) ? data.forward : null;
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		url: expectString(data, "url"),
		response: {
			status: expectNumber(response, "status"),
			contentType: expectString(response, "contentType"),
			body: expectString(response, "body"),
		},
		forward: forward
			? {
					port: expectNumber(forward, "port"),
					path: expectString(forward, "path"),
					target: expectString(forward, "target"),
				}
			: null,
		lastForward: parseDelivery(data.lastForward),
		requestCount: expectNumber(data, "requestCount"),
		createdAt: expectString(data, "createdAt"),
	};
}

export function parseProjectInboxes(value: unknown): ProjectInboxes {
	const data = expectRecord(value, "inboxes");
	return {
		items: expectArray(data, "items").map(parseInbox),
		used: expectNumber(data, "used"),
		max: expectNumber(data, "max"),
		canManage: expectBoolean(data, "canManage"),
	};
}

export async function fetchInboxes(projectId: string): Promise<ProjectInboxes> {
	return parseProjectInboxes(await apiRequest(inboxesPath(projectId)));
}

/** Owner only: 409 `INBOX_NAME_TAKEN`, 403 `PLAN_LIMIT_REACHED`. */
export async function createInbox(
	projectId: string,
	name: string,
	response: InboxResponse,
): Promise<InboxView> {
	return parseInbox(
		await apiRequest(inboxesPath(projectId), {
			method: "POST",
			body: { name, response },
		}),
	);
}

export async function updateInboxResponse(
	projectId: string,
	name: string,
	response: InboxResponse,
): Promise<InboxView> {
	return parseInbox(
		await apiRequest(inboxPath(projectId, name), {
			method: "PUT",
			body: { response },
		}),
	);
}

/** `null` stops forwarding. */
export async function setInboxForward(
	projectId: string,
	name: string,
	forward: { port: number; path: string } | null,
): Promise<InboxView> {
	return parseInbox(
		await apiRequest(`${inboxPath(projectId, name)}/forward`, {
			method: "PUT",
			body: { forward },
		}),
	);
}

export async function deleteInbox(
	projectId: string,
	name: string,
): Promise<void> {
	await apiRequest(inboxPath(projectId, name), { method: "DELETE" });
}

export function isNameTaken(error: unknown): boolean {
	return error instanceof ApiError && error.code === "INBOX_NAME_TAKEN";
}
