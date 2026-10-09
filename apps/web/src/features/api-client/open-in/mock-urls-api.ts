import { apiRequest } from "../../../lib/api-client";
import {
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../../lib/json-guards";
import type {
	MockEndpointUrl,
	MockResourceUrls,
	MockUrls,
} from "./mock-requests";

function parseEndpoint(value: unknown): MockEndpointUrl {
	const data = expectRecord(value, "mock endpoint");
	return {
		method: expectString(data, "method"),
		url: expectString(data, "url"),
	};
}

function parseResource(value: unknown): MockResourceUrls {
	const data = expectRecord(value, "mock resource");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		parentId: optionalString(data, "parentId"),
		depth: expectNumber(data, "depth"),
		collectionUrl: expectString(data, "collectionUrl"),
		itemUrl: expectString(data, "itemUrl"),
		endpoints: expectArray(data, "endpoints").map(parseEndpoint),
	};
}

/** `GET /projects/:projectId/mock-urls`: REST URLs of every resource. */
export async function fetchMockUrls(projectId: string): Promise<MockUrls> {
	const data = expectRecord(
		await apiRequest(
			`/api/v1/projects/${encodeURIComponent(projectId)}/mock-urls`,
		),
		"mock URLs",
	);
	return {
		projectId: expectString(data, "projectId"),
		mockBaseUrl: expectString(data, "mockBaseUrl"),
		resources: expectArray(data, "resources").map(parseResource),
	};
}
