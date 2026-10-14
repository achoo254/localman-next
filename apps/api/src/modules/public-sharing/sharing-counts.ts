import type {
	CollectionLinkKind,
	WorkspaceSharingSwitch,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { CollectionModel } from "../collections/collection-model.js";
import { CollectionAccessKeyModel } from "./collection-access-key-model.js";
import { CollectionLinkModel } from "./collection-link-model.js";
import { RunButtonModel } from "./run-button-model.js";

export interface StoppedCounts {
	readonly links: number;
	readonly accessKeys: number;
	readonly runButtons: number;
}

/**
 * What of the workspace's collections stops being served when `switches`
 * go off: public links (and public Run buttons) with `publicLinksAllowed`,
 * guest links with `guestsAllowed`, access keys with `accessKeysAllowed`.
 */
export async function countServedBySwitch(
	workspaceId: Types.ObjectId,
	switches: readonly WorkspaceSharingSwitch[],
): Promise<StoppedCounts> {
	if (switches.length === 0) return { links: 0, accessKeys: 0, runButtons: 0 };
	const rows = await CollectionModel.find({ workspaceId }, { _id: 1 }).lean<
		{ _id: Types.ObjectId }[]
	>();
	const ids = rows.map((row) => row._id);
	const kinds: CollectionLinkKind[] = [];
	if (switches.includes("publicLinksAllowed")) kinds.push("public");
	if (switches.includes("guestsAllowed")) kinds.push("guest");
	const links =
		kinds.length === 0
			? 0
			: await CollectionLinkModel.countDocuments({
					collectionId: { $in: ids },
					kind: { $in: kinds },
				});
	const accessKeys = switches.includes("accessKeysAllowed")
		? await CollectionAccessKeyModel.countDocuments({
				collectionId: { $in: ids },
			})
		: 0;
	const runButtons = switches.includes("publicLinksAllowed")
		? await RunButtonModel.countDocuments({
				collectionId: { $in: ids },
				visibility: "public",
			})
		: 0;
	return { links, accessKeys, runButtons };
}
