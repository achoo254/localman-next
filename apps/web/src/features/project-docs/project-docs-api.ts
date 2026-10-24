/** Public docs of a mock project: their settings and the public page, parsed. */
import { apiRequest } from "../../lib/api-client";
import {
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

export interface DocsSettings {
	published: boolean;
	/** The page anyone with it opens; `null` while unpublished. */
	url: string | null;
}

export interface DocsField {
	name: string;
	type: string;
	detail: string | null;
}

export interface DocsResource {
	name: string;
	depth: number;
	fields: DocsField[];
	endpoints: { method: string; path: string }[];
	example: JsonRecord;
}

export interface ProjectDocs {
	name: string;
	version: string;
	resources: DocsResource[];
}

const docsPath = (projectId: string): string =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/docs`;

function parseSettings(value: unknown): DocsSettings {
	const data = expectRecord(value, "docs settings");
	return {
		published: expectBoolean(data, "published"),
		url: optionalString(data, "url"),
	};
}

export async function fetchDocsSettings(
	projectId: string,
): Promise<DocsSettings> {
	return parseSettings(await apiRequest(docsPath(projectId)));
}

export async function setDocsPublished(
	projectId: string,
	published: boolean,
): Promise<DocsSettings> {
	return parseSettings(
		await apiRequest(docsPath(projectId), {
			method: "PUT",
			body: { published },
		}),
	);
}

function parseResource(value: unknown): DocsResource {
	const data = expectRecord(value, "docs resource");
	return {
		name: expectString(data, "name"),
		depth: expectNumber(data, "depth"),
		fields: expectArray(data, "fields").map((item) => {
			const field = expectRecord(item, "docs field");
			return {
				name: expectString(field, "name"),
				type: expectString(field, "type"),
				detail: optionalString(field, "detail"),
			};
		}),
		endpoints: expectArray(data, "endpoints").map((item) => {
			const endpoint = expectRecord(item, "docs endpoint");
			return {
				method: expectString(endpoint, "method"),
				path: expectString(endpoint, "path"),
			};
		}),
		example: expectRecord(data.example, "docs example"),
	};
}

/** Without signing in: a visitor never gets sent to the sign-in page. */
export async function fetchPublicDocs(slug: string): Promise<ProjectDocs> {
	const data = expectRecord(
		await apiRequest(`/api/v1/public/docs/${encodeURIComponent(slug)}`, {
			redirectOnUnauthorized: false,
		}),
		"project docs",
	);
	return {
		name: expectString(data, "name"),
		version: expectString(data, "version"),
		resources: expectArray(data, "resources").map(parseResource),
	};
}
