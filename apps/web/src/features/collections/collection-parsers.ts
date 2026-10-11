/**
 * Parsers of the collection API answers. Scalar fields go through the JSON
 * guards; drafts, auth, scripts and variables through the shared zod
 * schemas the API validates them with, so both sides agree on the shape.
 */
import {
	type CollectionDetail,
	type CollectionNode,
	type CollectionSummary,
	apiRequestDraftSchema,
	effectiveAuthSchema,
	requestAuthSchema,
	requestScriptsSchema,
	variableEntrySchema,
} from "@localman/shared/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { parseElementRole } from "../sharing/sharing-api";

/** The part of a zod schema the parsers need (the web does not import zod). */
interface SafeParser<T> {
	safeParse(value: unknown): { success: true; data: T } | { success: false };
}

function parseWith<T>(schema: SafeParser<T>, value: unknown, what: string): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new InvalidResponseError(what);
	return parsed.data;
}

export function parseSummary(value: unknown): CollectionSummary {
	const data = expectRecord(value, "collection");
	return {
		id: expectString(data, "id"),
		workspaceId: expectString(data, "workspaceId"),
		name: expectString(data, "name"),
		role: parseElementRole(data.role, "collection role"),
		favorite: expectBoolean(data, "favorite"),
		requestCount: expectNumber(data, "requestCount"),
		updatedAt: expectString(data, "updatedAt"),
	};
}

export function parseNode(value: unknown): CollectionNode {
	const data = expectRecord(value, "collection node");
	const base = {
		id: expectString(data, "id"),
		parentId: optionalString(data, "parentId"),
		order: expectString(data, "order"),
		name: expectString(data, "name"),
		description: expectString(data, "description"),
	};
	if (data.kind === "request") {
		const draft = parseWith(apiRequestDraftSchema, data.draft, "draft");
		return { kind: "request", ...base, draft };
	}
	if (data.kind !== "folder") throw new InvalidResponseError("node kind");
	return {
		kind: "folder",
		...base,
		auth: parseWith(requestAuthSchema, data.auth, "folder auth"),
		scripts: parseWith(requestScriptsSchema, data.scripts, "folder scripts"),
	};
}

export function parseDetail(value: unknown): CollectionDetail {
	const data = expectRecord(value, "collection detail");
	return {
		id: expectString(data, "id"),
		workspaceId: expectString(data, "workspaceId"),
		name: expectString(data, "name"),
		role: parseElementRole(data.role, "collection role"),
		description: expectString(data, "description"),
		auth: parseWith(effectiveAuthSchema, data.auth, "collection auth"),
		scripts: parseWith(requestScriptsSchema, data.scripts, "scripts"),
		variables: expectArray(data, "variables").map((item) =>
			parseWith(variableEntrySchema, item, "variable"),
		),
		createdBy: expectString(data, "createdBy"),
		createdAt: expectString(data, "createdAt"),
		updatedAt: expectString(data, "updatedAt"),
		nodes: expectArray(data, "nodes").map(parseNode),
	};
}

/** A collection in the trash (`client.listTrashedCollections`). */
export interface TrashedCollection {
	id: string;
	name: string;
	/** The workspace it was deleted from. */
	workspaceId: string;
	/** `null` once that workspace is gone too. */
	workspaceName: string | null;
	deletedAt: string;
	deletedBy: string;
	/** `null` for a removed account. */
	deletedByName: string | null;
	purgeAt: string;
	requestCount: number;
}

export function parseTrashed(value: unknown): TrashedCollection {
	const data = expectRecord(value, "trashed collection");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		workspaceId: expectString(data, "workspaceId"),
		workspaceName: optionalString(data, "workspaceName"),
		deletedAt: expectString(data, "deletedAt"),
		deletedBy: expectString(data, "deletedBy"),
		deletedByName: optionalString(data, "deletedByName"),
		purgeAt: expectString(data, "purgeAt"),
		requestCount: expectNumber(data, "requestCount"),
	};
}
