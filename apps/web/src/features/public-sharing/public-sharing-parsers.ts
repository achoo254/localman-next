/**
 * Parsers shared by the public sharing API answers: the redacted
 * collection a link shows, and the secret-looking places a dry run lists.
 * The tree goes through the shared zod schema the API builds it with.
 */
import {
	type PublicCollectionView,
	SECRET_LIKE_PLACES,
	type SecretLikeValue,
	collectionTreeSchema,
} from "@localman/shared/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectRecord,
	expectString,
} from "../../lib/json-guards";
import { parseWith } from "../collections/collection-parsers";

export function parseStringList(value: unknown, what: string): string[] {
	if (!Array.isArray(value)) throw new InvalidResponseError(what);
	return value.map((item) => {
		if (typeof item !== "string") throw new InvalidResponseError(what);
		return item;
	});
}

function parseWarning(value: unknown): SecretLikeValue {
	const data = expectRecord(value, "warning");
	const where = SECRET_LIKE_PLACES.find((place) => place === data.where);
	if (!where) throw new InvalidResponseError("warning place");
	return {
		where,
		path: parseStringList(data.path, "warning path"),
		key: expectString(data, "key"),
	};
}

/** `warnings` of a publishing answer (dry run or real). */
export function parseWarnings(data: JsonRecord): SecretLikeValue[] {
	return expectArray(data, "warnings").map(parseWarning);
}

export function parsePublicView(value: unknown): PublicCollectionView {
	const data = expectRecord(value, "public collection");
	return {
		name: expectString(data, "name"),
		description: expectString(data, "description"),
		tree: parseWith(collectionTreeSchema, data.tree, "tree"),
		updatedAt: expectString(data, "updatedAt"),
	};
}

/** `null`, or the record of a nullable object field. */
export function nullableRecord(
	data: JsonRecord,
	key: string,
): JsonRecord | null {
	const value = data[key];
	return value === null || value === undefined
		? null
		: expectRecord(value, key);
}
