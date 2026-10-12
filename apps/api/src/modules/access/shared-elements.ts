import type { ShareableElementType } from "@localman/shared/access";
import type { Types } from "mongoose";
import { ElementRoleModel } from "./element-role-model.js";

/** Shares read per round when collecting what a non-member may open. */
const SHARE_PAGE = 500;

/**
 * Elements of `type` shared with `sub` that `loadPage` keeps (it loads a
 * page of element ids, typically those of one workspace), read page by
 * page through all of their shares of that type until `max` are found.
 * Shares elsewhere are skipped, never counted against `max`.
 */
export async function collectSharedElements<T>(
	sub: string,
	type: ShareableElementType,
	max: number,
	loadPage: (elementIds: string[]) => Promise<T[]>,
): Promise<T[]> {
	const found: T[] = [];
	let after: Types.ObjectId | null = null;
	while (found.length < max) {
		const page: { _id: Types.ObjectId; elementId: string }[] =
			await ElementRoleModel.find(
				{
					userId: sub,
					elementType: type,
					...(after ? { _id: { $gt: after } } : {}),
				},
				{ elementId: 1 },
			)
				.sort({ _id: 1 })
				.limit(SHARE_PAGE)
				.lean<{ _id: Types.ObjectId; elementId: string }[]>();
		const ids = page.map((share) => share.elementId);
		if (ids.length > 0) found.push(...(await loadPage(ids)));
		const last = page.at(-1);
		if (!last || page.length < SHARE_PAGE) break;
		after = last._id;
	}
	return found;
}
