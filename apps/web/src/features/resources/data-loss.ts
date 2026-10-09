import type { DataChange, Resource } from "./resource-model";

/** Whether a resource below `resourceId` holds records that a write could drop. */
export function hasDescendantData(
	resources: readonly Resource[],
	resourceId: string,
): boolean {
	const below = new Set([resourceId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const item of resources) {
			if (
				item.parentId !== null &&
				below.has(item.parentId) &&
				!below.has(item.id)
			) {
				below.add(item.id);
				grew = true;
			}
		}
	}
	return resources.some(
		(item) => item.id !== resourceId && below.has(item.id) && item.count > 0,
	);
}

/** Resources other than the written one whose records a dry run says go. */
export function lostDescendants(
	changes: readonly DataChange[],
	resourceId: string,
): DataChange[] {
	return changes.filter(
		(change) =>
			change.resourceId !== resourceId &&
			change.countAfter < change.countBefore,
	);
}
