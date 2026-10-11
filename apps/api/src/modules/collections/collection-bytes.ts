import { OperationError } from "@localman/operations";
import type {
	ApiRequestDraft,
	CollectionRootFields,
	RequestAuth,
	RequestScripts,
} from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";

/**
 * Content one collection may hold, as UTF-8 bytes of JSON: a request is
 * capped at the saved-draft size, this caps the sum, so loading or
 * exporting a collection stays bounded.
 */
export const COLLECTION_BYTES_MAX = 20 * 1024 * 1024;

/** What a node stores beyond its place in the tree. */
export type NodePayload =
	| {
			readonly kind: "request";
			readonly name: string;
			readonly description: string;
			readonly draft: ApiRequestDraft;
	  }
	| {
			readonly kind: "folder";
			readonly name: string;
			readonly description: string;
			readonly auth: RequestAuth;
			readonly scripts: RequestScripts;
	  };

function jsonBytes(value: unknown): number {
	return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function rootBytes(root: CollectionRootFields): number {
	const { name, description, auth, scripts, variables } = root;
	return jsonBytes([name, description, auth, scripts, variables]);
}

export function nodeBytes(node: NodePayload): number {
	return node.kind === "request"
		? jsonBytes([node.name, node.description, node.draft])
		: jsonBytes([node.name, node.description, node.auth, node.scripts]);
}

export function collectionTooLarge(bytes: number): OperationError {
	return new OperationError(
		413,
		"COLLECTION_TOO_LARGE",
		`A collection holds at most ${COLLECTION_BYTES_MAX} bytes of content`,
		{ max: COLLECTION_BYTES_MAX, bytes },
	);
}

export interface RootChange {
	/** Change of `bytes` (negative when content goes). */
	readonly bytes?: number;
	/** Change of `requestCount`. */
	readonly requests?: number;
	/** Root fields written along (a root edit). */
	readonly set?: Readonly<Record<string, unknown>>;
}

/**
 * Applies a change to the live root inside the caller's transaction and
 * stamps who changed the collection last. Writing the root also makes a
 * concurrent trash or purge of it conflict with this transaction. 404 when
 * the collection is gone or trashed, 413 `COLLECTION_TOO_LARGE` when the
 * change would grow it past `COLLECTION_BYTES_MAX`.
 */
export async function chargeRoot(
	collectionId: Types.ObjectId,
	sub: string,
	session: ClientSession,
	change: RootChange = {},
): Promise<void> {
	const filter = { _id: collectionId, ...LIVE_COLLECTION };
	const root = await CollectionModel.findOne(filter, { bytes: 1 })
		.session(session)
		.lean<{ bytes?: number }>();
	if (!root) throw elementNotFound();
	const delta = change.bytes ?? 0;
	const next = (root.bytes ?? 0) + delta;
	if (delta > 0 && next > COLLECTION_BYTES_MAX) throw collectionTooLarge(next);
	await CollectionModel.updateOne(
		filter,
		{
			$set: { ...change.set, updatedBy: sub },
			$inc: { bytes: delta, requestCount: change.requests ?? 0 },
		},
		{ session },
	);
}
