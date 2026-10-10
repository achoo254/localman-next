import type {
	ElementRole,
	ShareableElementType,
} from "@localman/shared/access";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { isElementType, parseElementRole } from "./sharing-api";

export type AccessRequestStatus = "pending" | "approved" | "denied";

const STATUSES: readonly AccessRequestStatus[] = [
	"pending",
	"approved",
	"denied",
];

export function parseRequestStatus(value: unknown): AccessRequestStatus {
	const status = STATUSES.find((s) => s === value);
	if (!status) throw new InvalidResponseError("access request status");
	return status;
}

/** A request as its element's Editors see it (`sharing.getAccessRequest`). */
export interface AccessRequest {
	id: string;
	element: { type: ShareableElementType; id: string; name: string };
	/** `username` is null once the requester's account is gone. */
	requester: {
		username: string | null;
		name: string | null;
		picture: string | null;
	};
	role: ElementRole;
	message: string | null;
	status: AccessRequestStatus;
	createdAt: string;
}

function parseAccessRequest(value: unknown): AccessRequest {
	const data = expectRecord(value, "access request");
	const element = expectRecord(data.element, "element");
	const requester = expectRecord(data.requester, "requester");
	if (!isElementType(element.type)) throw new InvalidResponseError("type");
	return {
		id: expectString(data, "id"),
		element: {
			type: element.type,
			id: expectString(element, "id"),
			name: expectString(element, "name"),
		},
		requester: {
			username: optionalString(requester, "username"),
			name: optionalString(requester, "name"),
			picture: optionalString(requester, "picture"),
		},
		role: parseElementRole(data.role, "request role"),
		message: optionalString(data, "message"),
		status: parseRequestStatus(data.status),
		createdAt: expectString(data, "createdAt"),
	};
}

const requestPath = (requestId: string) =>
	`/api/v1/access-requests/${encodeURIComponent(requestId)}`;

/** 404 unless the caller is an Editor of the element. */
export async function fetchAccessRequest(
	requestId: string,
): Promise<AccessRequest> {
	return parseAccessRequest(await apiRequest(requestPath(requestId)));
}

/** `role`: the role the approver saw; 409 REQUEST_CHANGED if it changed since. */
export async function approveAccessRequest(
	requestId: string,
	role: ElementRole,
): Promise<AccessRequest> {
	return parseAccessRequest(
		await apiRequest(`${requestPath(requestId)}/approve`, {
			method: "POST",
			body: { role },
		}),
	);
}

export async function denyAccessRequest(
	requestId: string,
): Promise<AccessRequest> {
	return parseAccessRequest(
		await apiRequest(`${requestPath(requestId)}/deny`, { method: "POST" }),
	);
}
