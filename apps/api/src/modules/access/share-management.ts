import { OperationError } from "@localman/operations";
import type { ElementRole } from "@localman/shared/access";
import { Types } from "mongoose";
import { type ShareView, toShareViews } from "./element-access-view.js";
import type { ElementRecord } from "./element-adapters.js";
import {
	ElementRoleModel,
	type StoredElementRole,
} from "./element-role-model.js";

async function findShare(
	element: ElementRecord,
	shareId: string,
): Promise<StoredElementRole> {
	const row = Types.ObjectId.isValid(shareId)
		? await ElementRoleModel.findOne({
				_id: shareId,
				elementType: element.type,
				elementId: element.id,
			}).lean<StoredElementRole>()
		: null;
	if (!row) throw new OperationError(404, "NOT_FOUND", "Share not found");
	return row;
}

/** Sets the role of one share of the element (Manage access). */
export async function updateShare(
	element: ElementRecord,
	shareId: string,
	role: ElementRole,
): Promise<void> {
	const row = await findShare(element, shareId);
	await ElementRoleModel.updateOne({ _id: row._id }, { $set: { role } });
}

/** Removes one share of the element; with `dryRun`, only shows it. */
export async function removeShare(
	element: ElementRecord,
	shareId: string,
	dryRun: boolean,
): Promise<ShareView> {
	const row = await findShare(element, shareId);
	const [view] = await toShareViews([row], true);
	if (!view) throw new Error("Share view was not built");
	if (!dryRun) await ElementRoleModel.deleteOne({ _id: row._id });
	return view;
}
