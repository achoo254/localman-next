import { defineOperation } from "@localman/operations";
import {
	exportCollectionV21,
	findSecretLikeValues,
	nodesToCollectionTree,
	publicCollectionTree,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { elementNotFound } from "../access/access-policy.js";
import { requireCollection } from "../collections/collection-access.js";
import { toObjectId } from "../collections/collection-ids.js";
import {
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import { loadCollectionDetail } from "../collections/collection-store.js";
import { collectionForKey } from "./access-key-auth.js";
import {
	createAccessKey,
	listAccessKeys,
	revocableKey,
	revokeAccessKey,
	toKeyView,
} from "./access-key-service.js";
import { takeIpSlot } from "./public-sharing-limits.js";
import { WARNINGS_NOTE, secretWarnings } from "./public-sharing-views.js";
import { publicViewOf } from "./public-tree.js";
import { requirePublishable } from "./publish-access.js";

const PATH = `${COLLECTION_PATH}/access-keys`;

const accessKeyView = z.object({
	id: z.string(),
	name: z.string(),
	last4: z.string(),
	/** Who created it. */
	userId: z.string(),
	createdAt: z.string(),
	lastUsedAt: z.string().nullable(),
	/** 60 days after the last use. */
	expiresAt: z.string(),
});

export const createAccessKeyOperation = defineOperation({
	id: "sharing.createCollectionAccessKey",
	method: "POST",
	path: PATH,
	summary: "Create a read-only access key of a collection",
	description: `A key for scripts and CI: \`GET /api/v1/public/collections/:collectionId?access_key=<key>\` returns the collection as redacted Collection v2.1 JSON, always the current version. The key is returned once (\`key\`); only its hash is kept. It stops after 60 days without use, when revoked, when its creator stops being an Admin or Editor member of the workspace, or when an Admin turns access keys off (403 ACCESS_KEYS_DISABLED to create one then). At most 10 keys per person and collection (409 ACCESS_KEY_LIMIT_REACHED). Only Admins and Editors who are members of the workspace (403 FORBIDDEN). ${WARNINGS_NOTE} Call with dryRun to see the warnings first.`,
	input: z.object({
		collectionId: collectionIdSchema,
		name: z.string().trim().min(1).max(100),
	}),
	output: z.object({
		dryRun: z.boolean(),
		key: z.string().nullable(),
		accessKey: accessKeyView.nullable(),
		warnings: secretWarnings,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	createsCredential: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requirePublishable(
			sub,
			input.collectionId,
			"accessKeysAllowed",
		);
		const view = await publicViewOf({ _id: access.collectionId });
		const warnings = findSecretLikeValues(view.tree);
		if (ctx.dryRun) {
			return { dryRun: true, key: null, accessKey: null, warnings };
		}
		const created = await createAccessKey(access.collectionId, sub, input.name);
		return {
			dryRun: false,
			key: created.key,
			accessKey: created.view,
			warnings,
		};
	},
});

export const listAccessKeysOperation = defineOperation({
	id: "sharing.listCollectionAccessKeys",
	method: "GET",
	path: PATH,
	summary: "List the access keys of a collection",
	description:
		"The caller's keys of the collection (an Admin of the workspace sees everyone's): name, last characters, creator, creation, last use and expiry. Never the key or its hash. 404 NOT_FOUND for a collection the caller cannot see.",
	input: z.object({ collectionId: collectionIdSchema }),
	output: z.object({ items: z.array(accessKeyView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, { collectionId }) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, collectionId, "view");
		return {
			items: await listAccessKeys(
				access.collectionId,
				access.element.workspaceId,
				sub,
			),
		};
	},
});

export const revokeAccessKeyOperation = defineOperation({
	id: "sharing.revokeCollectionAccessKey",
	method: "DELETE",
	path: `${PATH}/:keyId`,
	summary: "Revoke an access key of a collection",
	description:
		"The key stops at once and is deleted. Its creator or an Admin of the workspace (404 NOT_FOUND for anyone else and for an unknown key). Call with dryRun to see the key first.",
	input: z.object({
		collectionId: collectionIdSchema,
		keyId: z.string().min(1).max(64),
	}),
	output: z.object({
		dryRun: z.boolean(),
		revoked: z.boolean(),
		accessKey: accessKeyView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, input.collectionId, "view");
		const keyId = toObjectId(input.keyId);
		if (!keyId) throw elementNotFound();
		const key = await revocableKey(
			access.collectionId,
			access.element.workspaceId,
			keyId,
			sub,
		);
		const revoked = ctx.dryRun ? false : await revokeAccessKey(key._id);
		return { dryRun: ctx.dryRun, revoked, accessKey: toKeyView(key) };
	},
});

/** A Collection v2.1 document written by the shared exporter. */
const collectionV21View = z.looseObject({
	info: z.looseObject({ name: z.string(), schema: z.string() }),
	item: z.array(z.unknown()),
});

export const getCollectionByAccessKeyOperation = defineOperation({
	id: "public.getCollectionByAccessKey",
	method: "GET",
	path: "/public/collections/:collectionId",
	summary: "Read a collection as JSON with an access key",
	description:
		"Public, authenticated by `?access_key=`. The current collection as redacted Collection v2.1 JSON. 401 ACCESS_KEY_INVALID (one message) for a wrong, revoked or expired key, a key of another collection, a creator who is no longer an Admin or Editor of the workspace, access keys turned off there, or a trashed collection; 429 RATE_LIMITED per client address and per key.",
	input: z.object({
		collectionId: collectionIdSchema,
		access_key: z.string().max(200).optional(),
	}),
	output: collectionV21View,
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "public",
	mcp: {
		exempt:
			"Endpoint cho script và CI xác thực bằng access key; agent đọc collection của mình qua client.exportCollection",
	},
	handler: async (ctx, input) => {
		// Counted before any lookup, so guessing keys costs the guesser.
		await takeIpSlot("accessKey", ctx.clientIp);
		const collection = await collectionForKey(
			input.collectionId,
			input.access_key,
		);
		const detail = await loadCollectionDetail(collection._id, "viewer", null);
		const v21 = exportCollectionV21(
			publicCollectionTree(nodesToCollectionTree(detail)),
		);
		// Plain object copies: interfaces lack the index signature of the view.
		return { ...v21, info: { ...v21.info } };
	},
});

export const accessKeyOperations = [
	createAccessKeyOperation,
	listAccessKeysOperation,
	revokeAccessKeyOperation,
	getCollectionByAccessKeyOperation,
] as const;
