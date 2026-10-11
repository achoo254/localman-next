import {
	type WorkspaceRole,
	elementRoleAllows,
	workspaceRoleAllows,
} from "@localman/shared/access";
import type { CollectionSummary } from "@localman/shared/api-client";
import { useCallback, useMemo } from "react";
import type { TreePermissions } from "./tree-row-menu";

/**
 * What the caller may do in the tree: add collections (workspace role),
 * and per collection edit it (its own role: workspace role or share,
 * the stronger) and move or delete it (also Admin or Editor in the
 * workspace, as the API requires).
 */
export function useTreePermissions(
	role: WorkspaceRole | null,
	collections: readonly CollectionSummary[] | undefined,
) {
	const canAdd = workspaceRoleAllows(role, "addElements");
	const canManage = workspaceRoleAllows(role, "moveDeleteElements");
	const roles = useMemo(
		() => new Map((collections ?? []).map((item) => [item.id, item.role])),
		[collections],
	);
	const permissionsOf = useCallback(
		(collectionId: string): TreePermissions => ({
			edit: elementRoleAllows(
				"collection",
				roles.get(collectionId) ?? null,
				"edit",
			),
			manage: canManage,
			add: canAdd,
		}),
		[roles, canManage, canAdd],
	);
	return { canAdd, permissionsOf };
}
