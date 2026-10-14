/** Read-only access keys of a collection, for scripts and CI. */
import type { SecretLikeValue } from "@localman/shared/api-client";
import { apiRequest, withDryRun } from "../../lib/api-client";
import {
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { nullableRecord, parseWarnings } from "./public-sharing-parsers";

export interface AccessKey {
	id: string;
	name: string;
	/** Last four characters of the key, to tell keys apart. */
	last4: string;
	userId: string;
	createdAt: string;
	lastUsedAt: string | null;
	/** Unused for 60 days, the key stops working. */
	expiresAt: string;
}

export interface CreateAccessKeyResult {
	dryRun: boolean;
	/** The key itself, shown once; null on a dry run. */
	key: string | null;
	accessKey: AccessKey | null;
	warnings: SecretLikeValue[];
}

const keysPath = (collectionId: string) =>
	`/api/v1/collections/${encodeURIComponent(collectionId)}/access-keys`;

function parseAccessKey(value: unknown): AccessKey {
	const data: JsonRecord = expectRecord(value, "access key");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		last4: expectString(data, "last4"),
		userId: expectString(data, "userId"),
		createdAt: expectString(data, "createdAt"),
		lastUsedAt: optionalString(data, "lastUsedAt"),
		expiresAt: expectString(data, "expiresAt"),
	};
}

export async function fetchAccessKeys(
	collectionId: string,
): Promise<AccessKey[]> {
	const data = expectRecord(
		await apiRequest(keysPath(collectionId)),
		"access keys",
	);
	return expectArray(data, "items").map(parseAccessKey);
}

export async function createAccessKey(
	collectionId: string,
	name: string,
	dryRun: boolean,
): Promise<CreateAccessKeyResult> {
	const data = expectRecord(
		await apiRequest(withDryRun(keysPath(collectionId), dryRun), {
			method: "POST",
			body: { name: name.trim() },
		}),
		"access key",
	);
	const accessKey = nullableRecord(data, "accessKey");
	return {
		dryRun: expectBoolean(data, "dryRun"),
		key: optionalString(data, "key"),
		accessKey: accessKey ? parseAccessKey(accessKey) : null,
		warnings: parseWarnings(data),
	};
}

export async function revokeAccessKey(
	collectionId: string,
	keyId: string,
): Promise<void> {
	await apiRequest(`${keysPath(collectionId)}/${encodeURIComponent(keyId)}`, {
		method: "DELETE",
	});
}

/** Where scripts read the collection; the key goes in `access_key`. */
export const publicCollectionPath = (collectionId: string): string =>
	`/api/v1/public/collections/${encodeURIComponent(collectionId)}`;
