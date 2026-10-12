/**
 * Parsers of the collection API answers. Scalar fields go through the JSON
 * guards; drafts, auth, scripts and variables through the shared zod
 * schemas the API validates them with, so both sides agree on the shape.
 */
import {
	type CollectionDetail,
	type CollectionNode,
	type CollectionStatus,
	type CollectionSummary,
	type TrashedCollectionSummary,
	apiRequestDraftSchema,
	collectionStatusSchema,
	effectiveAuthSchema,
	exampleResponseSchema,
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
import {
	parseEnvironmentLink,
	parseMockProjectLink,
} from "./collection-link-parsers";

/** The part of a zod schema the parsers need (the web does not import zod). */
interface SafeParser<T> {
	safeParse(value: unknown): { success: true; data: T } | { success: false };
}

function parseWith<T>(schema: SafeParser<T>, value: unknown, what: string): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new InvalidResponseError(what);
	return parsed.data;
}

export function parseTags(value: unknown): string[] {
	if (!Array.isArray(value)) throw new InvalidResponseError("tags");
	return value.map((tag) => {
		if (typeof tag !== "string") throw new InvalidResponseError("tag");
		return tag;
	});
}

export function parseStatus(value: unknown): CollectionStatus | null {
	return value === null || value === undefined
		? null
		: parseWith(collectionStatusSchema, value, "status");
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
		tags: parseTags(data.tags ?? []),
		status: parseStatus(data.status),
		updatedAt: expectString(data, "updatedAt"),
	};
}

export function parseNode(value: unknown): CollectionNode {
	const data = expectRecord(value, "collection node");
	if (data.kind === "example") {
		return {
			kind: "example",
			id: expectString(data, "id"),
			parentId: expectString(data, "parentId"),
			order: expectString(data, "order"),
			name: expectString(data, "name"),
			request: parseWith(
				apiRequestDraftSchema,
				data.request,
				"example request",
			),
			response: parseWith(
				exampleResponseSchema,
				data.response,
				"example response",
			),
		};
	}
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
		tags: parseTags(data.tags ?? []),
		status: parseStatus(data.status),
		createdBy: expectString(data, "createdBy"),
		createdByName: optionalString(data, "createdByName"),
		createdAt: expectString(data, "createdAt"),
		updatedBy: expectString(data, "updatedBy"),
		updatedByName: optionalString(data, "updatedByName"),
		updatedAt: expectString(data, "updatedAt"),
		mockProject: parseMockProjectLink(data.mockProject),
		relatedEnvironment: parseEnvironmentLink(data.relatedEnvironment),
		nodes: expectArray(data, "nodes").map(parseNode),
	};
}

/** A collection in the trash (`client.listTrashedCollections`). */
export type TrashedCollection = TrashedCollectionSummary;

export function parseTrashed(value: unknown): TrashedCollection {
	const data = expectRecord(value, "trashed collection");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		workspaceId: expectString(data, "workspaceId"),
		workspaceName: optionalString(data, "workspaceName"),
		requestCount: expectNumber(data, "requestCount"),
		tags: parseTags(data.tags ?? []),
		status: parseStatus(data.status),
		deletedAt: expectString(data, "deletedAt"),
		deletedBy: expectString(data, "deletedBy"),
		deletedByName: optionalString(data, "deletedByName"),
		purgeAt: expectString(data, "purgeAt"),
	};
}
