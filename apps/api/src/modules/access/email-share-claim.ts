import type { ElementRole } from "@localman/shared/access";
import type { Types } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { UserModel } from "../users/user-model.js";
import type { ElementRecord } from "./element-adapters.js";
import { ElementRoleModel } from "./element-role-model.js";
import { addresseeProblem } from "./invite-addressee.js";

/** The fields of a share the access check reads. */
export interface ShareRow {
	readonly _id: Types.ObjectId;
	readonly userId?: string | null;
	readonly email?: string | null;
	readonly role: ElementRole;
}

async function emailOf(sub: string): Promise<string | null> {
	const user = await UserModel.findOne({ sub })
		.select("email")
		.lean<{ email?: string | null }>();
	return user?.email?.trim().toLowerCase() || null;
}

/**
 * Turns the share addressed to `sub`'s email into a share of their
 * account and returns its role, `null` when there is none. Only an email
 * the IdP verified claims it (`addresseeProblem`), as for invitations.
 */
export async function claimEmailShare(
	sub: string,
	element: ElementRecord,
	rows: readonly ShareRow[],
): Promise<ElementRole | null> {
	const emailRows = rows.filter((row) => row.email);
	if (emailRows.length === 0) return null;
	const email = await emailOf(sub);
	const row = emailRows.find((candidate) => candidate.email === email);
	if (!row || (await addresseeProblem(sub, { email: row.email })) !== null) {
		return null;
	}
	try {
		await ElementRoleModel.updateOne(
			{ _id: row._id, email: row.email },
			{ $set: { userId: sub }, $unset: { email: 1 } },
		);
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		// The account already holds a share (its own, or a concurrent claim):
		// merge into it, keeping the stronger role of the two.
		await ElementRoleModel.deleteOne({ _id: row._id });
		if (row.role === "editor") {
			await ElementRoleModel.updateOne(
				{ elementType: element.type, elementId: element.id, userId: sub },
				{ $set: { role: "editor" } },
			);
		}
		const own = await ElementRoleModel.findOne(
			{ elementType: element.type, elementId: element.id, userId: sub },
			{ role: 1 },
		).lean<{ role: ElementRole }>();
		return own?.role ?? null;
	}
	return row.role;
}
