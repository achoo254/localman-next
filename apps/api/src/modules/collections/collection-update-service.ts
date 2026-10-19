import type {
	CollectionDetail,
	collectionUpdateSchema,
} from "@localman/shared/api-client";
import type { z } from "zod";
import { elementNotFound } from "../access/access-policy.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireCollection } from "./collection-access.js";
import { rootBytes } from "./collection-bytes.js";
import {
	requireLinkableEnvironment,
	requireReadableProject,
} from "./collection-links.js";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "./collection-model.js";
import {
	keepWithheldAuth,
	keepWithheldSecrets,
} from "./collection-secret-keep.js";
import { loadCollectionDetail } from "./collection-store.js";
import { rootRevision, rootStateOf } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";
import { foldSearchText } from "./search-text.js";

export type CollectionUpdate = z.infer<typeof collectionUpdateSchema>;

/**
 * Edits the root (name, description, auth, scripts, variables, tags,
 * status) under the workspace lock, within the collection's byte budget,
 * with a changelog entry. `keepWithheld` (an agent's write): a secret or
 * credential sent back blank keeps its stored value
 * (`collection-secret-keep.ts`).
 */
export async function updateCollection(
	sub: string,
	id: string,
	update: CollectionUpdate,
	keepWithheld = false,
): Promise<CollectionDetail> {
	const { element, collectionId, role } = await requireCollection(
		sub,
		id,
		"edit",
	);
	const { linkedEnvironmentId, mockProjectId, ...content } = update;
	const set: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(content)) {
		if (value !== undefined) set[key] = value;
	}
	if (content.name !== undefined) {
		set.searchName = foldSearchText(content.name);
	}
	// Links stay out of the changelog; `null` records "none".
	if (linkedEnvironmentId !== undefined) {
		set.linkedEnvironmentId =
			linkedEnvironmentId === null
				? null
				: await requireLinkableEnvironment(
						sub,
						element.workspaceId,
						linkedEnvironmentId,
					);
	}
	if (mockProjectId !== undefined) {
		set.mockProjectId =
			mockProjectId === null
				? null
				: await requireReadableProject(sub, mockProjectId);
	}
	await inWorkspaceTransaction(element.workspaceId, async (session) => {
		const root = await CollectionModel.findOne({
			_id: collectionId,
			...LIVE_COLLECTION,
		})
			.session(session)
			.lean<StoredCollection>();
		if (!root) throw elementNotFound();
		const before = rootStateOf(root);
		const after = { ...before, ...definedOf(content) };
		if (keepWithheld && content.variables) {
			after.variables = keepWithheldSecrets(content.variables, root.variables);
			set.variables = after.variables;
		}
		if (keepWithheld && content.auth) {
			after.auth = keepWithheldAuth(content.auth, root.auth);
			set.auth = after.auth;
		}
		const bytes = rootBytes(after) - rootBytes(before);
		const revision = rootRevision(
			"update",
			element.id,
			after.name,
			before,
			after,
		);
		await chargeRoot(collectionId, sub, session, {
			bytes,
			set,
			revisions: [revision],
		});
	});
	return loadCollectionDetail(collectionId, role, sub);
}

type ContentUpdate = Omit<
	CollectionUpdate,
	"linkedEnvironmentId" | "mockProjectId"
>;

/** The fields of `update` that were sent (absent ones stay). */
function definedOf(update: ContentUpdate): ContentUpdate {
	return Object.fromEntries(
		Object.entries(update).filter(([, value]) => value !== undefined),
	);
}
