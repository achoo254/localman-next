/** Parsers of a collection's links (related mock project and environment). */
import {
	type CollectionEnvironmentLink,
	type CollectionMockProjectLink,
	ENVIRONMENT_COLORS,
} from "@localman/shared/api-client";
import {
	InvalidResponseError,
	expectRecord,
	expectString,
} from "../../lib/json-guards";

/** An older API leaves the links out: read as none. */
export function parseMockProjectLink(
	value: unknown,
): CollectionMockProjectLink | null {
	if (value === null || value === undefined) return null;
	const data = expectRecord(value, "mock project link");
	return { id: expectString(data, "id"), name: expectString(data, "name") };
}

export function parseEnvironmentLink(
	value: unknown,
): CollectionEnvironmentLink | null {
	if (value === null || value === undefined) return null;
	const data = expectRecord(value, "environment link");
	const color = ENVIRONMENT_COLORS.find((item) => item === data.color);
	if (!color) throw new InvalidResponseError("environment link color");
	const source =
		data.source === "linked" || data.source === "shared" ? data.source : null;
	if (!source) throw new InvalidResponseError("environment link source");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		color,
		source,
	};
}
