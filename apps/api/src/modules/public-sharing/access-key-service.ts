import { OperationError } from "@localman/operations";
import { workspaceRoleAllows } from "@localman/shared/access";
import type { Types } from "mongoose";
import { issuePrefixedToken } from "../../lib/prefixed-token.js";
import { elementNotFound } from "../access/access-policy.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { expiresAt } from "./access-key-auth.js";
import {
	ACCESS_KEY_PREFIX,
	CollectionAccessKeyModel,
	type StoredAccessKey,
} from "./collection-access-key-model.js";

/** Keys one person may hold on one collection. */
export const ACCESS_KEYS_PER_USER_MAX = 10;

export interface AccessKeyView {
	id: string;
	name: string;
	last4: string;
	userId: string;
	createdAt: string;
	lastUsedAt: string | null;
	expiresAt: string;
}

export function toKeyView(key: StoredAccessKey): AccessKeyView {
	return {
		id: key._id.toHexString(),
		name: key.name,
		last4: key.last4,
		userId: key.userId,
		createdAt: key.createdAt.toISOString(),
		lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
		expiresAt: expiresAt(key).toISOString(),
	};
}

export async function createAccessKey(
	collectionId: Types.ObjectId,
	sub: string,
	name: string,
): Promise<{ key: string; view: AccessKeyView }> {
	const held = await CollectionAccessKeyModel.countDocuments({
		collectionId,
		userId: sub,
	});
	if (held >= ACCESS_KEYS_PER_USER_MAX) {
		throw new OperationError(
			409,
			"ACCESS_KEY_LIMIT_REACHED",
			`You hold at most ${ACCESS_KEYS_PER_USER_MAX} access keys per collection`,
			{ max: ACCESS_KEYS_PER_USER_MAX },
		);
	}
	const issued = issuePrefixedToken(ACCESS_KEY_PREFIX);
	const created = await CollectionAccessKeyModel.create({
		collectionId,
		userId: sub,
		name,
		keyHash: issued.hash,
		last4: issued.last4,
	});
	return {
		key: issued.token,
		view: toKeyView(created.toObject<StoredAccessKey>()),
	};
}

/** Admins of the workspace see and revoke every key; others their own. */
async function isWorkspaceAdmin(
	sub: string,
	workspaceId: Types.ObjectId,
): Promise<boolean> {
	const workspace = await findWorkspaceById(workspaceId.toHexString());
	return (
		workspace !== null &&
		workspaceRoleAllows(await workspaceRoleOf(sub, workspace), "manageMembers")
	);
}

export async function listAccessKeys(
	collectionId: Types.ObjectId,
	workspaceId: Types.ObjectId,
	sub: string,
): Promise<AccessKeyView[]> {
	const all = await isWorkspaceAdmin(sub, workspaceId);
	const keys = await CollectionAccessKeyModel.find(
		all ? { collectionId } : { collectionId, userId: sub },
	)
		.sort({ createdAt: -1 })
		.lean<StoredAccessKey[]>();
	return keys.map(toKeyView);
}

/** The key if `sub` may revoke it; 404 otherwise. */
export async function revocableKey(
	collectionId: Types.ObjectId,
	workspaceId: Types.ObjectId,
	keyId: Types.ObjectId,
	sub: string,
): Promise<StoredAccessKey> {
	const key = await CollectionAccessKeyModel.findOne({
		_id: keyId,
		collectionId,
	}).lean<StoredAccessKey>();
	if (!key) throw elementNotFound();
	if (key.userId !== sub && !(await isWorkspaceAdmin(sub, workspaceId))) {
		throw elementNotFound();
	}
	return key;
}

export async function revokeAccessKey(keyId: Types.ObjectId): Promise<boolean> {
	const result = await CollectionAccessKeyModel.deleteOne({ _id: keyId });
	return result.deletedCount > 0;
}
