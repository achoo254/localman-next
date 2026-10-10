import {
	ELEMENT_ROLES,
	type ElementRole,
	SHAREABLE_ELEMENT_TYPES,
	type ShareableElementType,
	WORKSPACE_TYPES,
	type WorkspaceType,
} from "@localman/shared/access";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** An element as the caller sees it (`sharing.getElement`). */
export interface ElementSummary {
	type: ShareableElementType;
	id: string;
	name: string;
	workspaceId: string;
	/** The stronger of the caller's workspace role and shared role. */
	role: ElementRole;
}

export interface ElementShare {
	id: string;
	/** null for a share to an email without an account. */
	userId: string | null;
	/** Email of such a share; shown to people who manage roles only. */
	email: string | null;
	username: string | null;
	name: string | null;
	picture: string | null;
	role: ElementRole;
}

/** "Manage access": the workspace (null when gone) and the shares. */
export interface ElementAccess {
	workspace: {
		id: string;
		name: string;
		type: WorkspaceType;
		memberCount: number;
	} | null;
	shares: ElementShare[];
}

export function isElementType(value: unknown): value is ShareableElementType {
	return SHAREABLE_ELEMENT_TYPES.some((type) => type === value);
}

export function parseElementRole(value: unknown, what: string): ElementRole {
	const role = ELEMENT_ROLES.find((r) => r === value);
	if (!role) throw new InvalidResponseError(what);
	return role;
}

export const elementPath = (type: ShareableElementType, id: string): string =>
	`/elements/${type}/${encodeURIComponent(id)}`;

const apiPath = (type: ShareableElementType, id: string) =>
	`/api/v1${elementPath(type, id)}`;

function parseSummary(value: unknown): ElementSummary {
	const data = expectRecord(value, "element");
	if (!isElementType(data.type)) throw new InvalidResponseError("type");
	return {
		type: data.type,
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		workspaceId: expectString(data, "workspaceId"),
		role: parseElementRole(data.role, "element role"),
	};
}

function parseShare(value: unknown): ElementShare {
	const data = expectRecord(value, "share");
	return {
		id: expectString(data, "id"),
		userId: optionalString(data, "userId"),
		email: optionalString(data, "email"),
		username: optionalString(data, "username"),
		name: optionalString(data, "name"),
		picture: optionalString(data, "picture"),
		role: parseElementRole(data.role, "share role"),
	};
}

function parseAccess(value: unknown): ElementAccess {
	const data = expectRecord(value, "element access");
	const ws =
		data.workspace === null ? null : expectRecord(data.workspace, "workspace");
	const type = ws ? WORKSPACE_TYPES.find((t) => t === ws.type) : undefined;
	if (ws && !type) throw new InvalidResponseError("workspace type");
	return {
		workspace:
			ws && type
				? {
						id: expectString(ws, "id"),
						name: expectString(ws, "name"),
						type,
						memberCount: expectNumber(ws, "memberCount"),
					}
				: null,
		shares: expectArray(data, "shares").map(parseShare),
	};
}

/** 404 when the element does not exist or the caller has no role on it. */
export async function fetchElement(
	type: ShareableElementType,
	id: string,
): Promise<ElementSummary> {
	return parseSummary(await apiRequest(apiPath(type, id)));
}

export async function fetchElementAccess(
	type: ShareableElementType,
	id: string,
): Promise<ElementAccess> {
	return parseAccess(await apiRequest(`${apiPath(type, id)}/access`));
}

export interface ShareInput {
	usernameOrEmail: string;
	role: ElementRole;
	/** Collections only: share this environment too. */
	includeEnvironmentId?: string;
}

export async function shareElement(
	type: ShareableElementType,
	id: string,
	input: ShareInput,
): Promise<ElementAccess> {
	return parseAccess(
		await apiRequest(`${apiPath(type, id)}/shares`, {
			method: "POST",
			body: input,
		}),
	);
}

export async function updateShareRole(
	type: ShareableElementType,
	id: string,
	shareId: string,
	role: ElementRole,
): Promise<ElementAccess> {
	return parseAccess(
		await apiRequest(
			`${apiPath(type, id)}/shares/${encodeURIComponent(shareId)}`,
			{ method: "PATCH", body: { role } },
		),
	);
}

export async function removeShare(
	type: ShareableElementType,
	id: string,
	shareId: string,
): Promise<void> {
	await apiRequest(
		`${apiPath(type, id)}/shares/${encodeURIComponent(shareId)}`,
		{ method: "DELETE" },
	);
}

/** Always "sent" when accepted, whether or not the element exists. */
export async function requestElementAccess(
	type: ShareableElementType,
	id: string,
	role: ElementRole,
	message: string,
): Promise<void> {
	const text = message.trim();
	await apiRequest(`${apiPath(type, id)}/access-requests`, {
		method: "POST",
		body: { role, ...(text ? { message: text } : {}) },
	});
}
