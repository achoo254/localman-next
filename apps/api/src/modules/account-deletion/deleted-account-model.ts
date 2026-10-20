import { createHash } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/** A deletion that crashed releases its lock after this long. */
const DELETION_LOCK_MS = 10 * 60_000;

/**
 * One row per account id that started or finished a deletion, in its
 * tenant (docs/decisions/0007): only the SHA-256 of the IdP subject, never
 * the subject or anything else. `lockedUntil` serializes concurrent
 * deletions of one account; `deletedAt` marks a finished one, so the same
 * IdP account signing in later is asked before a new account is made and
 * gets no second automatic extended-limits period.
 */
const deletedAccountSchema = new Schema(
	{
		subHash: { type: String, required: true },
		deletedAt: { type: Date },
		lockedUntil: { type: Date },
	},
	{ collection: "deleted_accounts", versionKey: false },
);
deletedAccountSchema.index({ subHash: 1 }, { unique: true });

deletedAccountSchema.plugin(tenantScopePlugin);
export const DeletedAccountModel = mongoose.model(
	"DeletedAccount",
	deletedAccountSchema,
);

/** The only form in which a deleted account's id is kept. */
export function subHashOf(sub: string): string {
	return createHash("sha256").update(sub, "utf8").digest("hex");
}

/**
 * Takes the account's deletion lock; `false` while another deletion of
 * the same account holds it (two tabs, a double click).
 */
export async function takeDeletionLock(
	sub: string,
	now = new Date(),
): Promise<boolean> {
	try {
		await DeletedAccountModel.updateOne(
			{
				subHash: subHashOf(sub),
				$or: [
					{ lockedUntil: { $exists: false } },
					{ lockedUntil: { $lte: now } },
				],
			},
			{ $set: { lockedUntil: new Date(now.getTime() + DELETION_LOCK_MS) } },
			{ upsert: true },
		);
		return true;
	} catch (error) {
		// The row exists with a live lock: the upsert hit the unique index.
		if (isDuplicateKeyError(error)) return false;
		throw error;
	}
}

export async function releaseDeletionLock(sub: string): Promise<void> {
	await DeletedAccountModel.updateOne(
		{ subHash: subHashOf(sub) },
		{ $unset: { lockedUntil: 1 } },
	);
}

/** Records that the account was deleted (just before its user row goes). */
export async function markAccountDeleted(sub: string): Promise<void> {
	await DeletedAccountModel.updateOne(
		{ subHash: subHashOf(sub) },
		{ $set: { deletedAt: new Date() } },
		{ upsert: true },
	);
}

/** Whether a Localman account of this IdP subject was deleted before. */
export async function wasAccountDeleted(sub: string): Promise<boolean> {
	const row = await DeletedAccountModel.exists({
		subHash: subHashOf(sub),
		deletedAt: { $exists: true },
	});
	return row !== null;
}
