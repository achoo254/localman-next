import type {
	ForkInfo,
	ForkListItem,
	ForkStatus,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { elementRoleOf } from "../access/access-policy.js";
import { elementAdapter } from "../access/element-adapters.js";
import { displayNames } from "../users/display-names.js";
import { findLink } from "./fork-access.js";
import { type ForkKind, ForkModel, type StoredFork } from "./fork-model.js";

/** Forks listed at most. */
const FORKS_LISTED = 200;

/** The element by id if `sub` holds a role on it, else `null`. */
async function readable(sub: string, kind: ForkKind, id: Types.ObjectId) {
	const element = await elementAdapter(kind)?.load(id.toHexString());
	if (!element) return null;
	return (await elementRoleOf(sub, element, { claim: false })) ? element : null;
}

async function forkInfo(
	sub: string,
	kind: ForkKind,
	link: StoredFork,
): Promise<ForkInfo> {
	const [source, names] = await Promise.all([
		readable(sub, kind, link.sourceId),
		displayNames([link.createdBy]),
	]);
	return {
		label: link.label,
		createdBy: link.createdBy,
		createdByName: names.get(link.createdBy) ?? null,
		createdAt: link.createdAt.toISOString(),
		source: {
			id: link.sourceId.toHexString(),
			name: source?.name ?? null,
			available: source !== null,
		},
	};
}

/**
 * Whether the element is a fork (its source named only when the caller
 * can open it) and how many forks it has.
 */
export async function forkStatusOf(
	sub: string,
	kind: ForkKind,
	elementId: Types.ObjectId,
): Promise<ForkStatus> {
	const [link, forkCount] = await Promise.all([
		findLink(kind, elementId),
		ForkModel.countDocuments({ kind, sourceId: elementId }),
	]);
	return { fork: link ? await forkInfo(sub, kind, link) : null, forkCount };
}

/** Its forks, newest first, with whether the caller may open each. */
export async function forksOf(
	sub: string,
	kind: ForkKind,
	elementId: Types.ObjectId,
): Promise<ForkListItem[]> {
	const links = await ForkModel.find({ kind, sourceId: elementId })
		.sort({ createdAt: -1 })
		.limit(FORKS_LISTED)
		.lean<StoredFork[]>();
	const names = await displayNames(links.map((link) => link.createdBy));
	return Promise.all(
		links.map(async (link) => ({
			forkId: link.forkId.toHexString(),
			label: link.label,
			createdByName: names.get(link.createdBy) ?? null,
			createdAt: link.createdAt.toISOString(),
			canOpen: (await readable(sub, kind, link.forkId)) !== null,
		})),
	);
}
