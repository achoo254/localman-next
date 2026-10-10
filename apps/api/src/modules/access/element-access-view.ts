import {
	ELEMENT_ROLES,
	type ElementRole,
	SHAREABLE_ELEMENT_TYPES,
	WORKSPACE_TYPES,
} from "@localman/shared/access";
import { z } from "zod";
import { UserModel } from "../users/user-model.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import type { ElementRecord } from "./element-adapters.js";
import {
	ElementRoleModel,
	type StoredElementRole,
} from "./element-role-model.js";

/** Path params of every `/elements/:elementType/:elementId` operation. */
export const elementParams = {
	elementType: z.enum(SHAREABLE_ELEMENT_TYPES),
	elementId: z.string().min(1).max(64),
};

export const elementSummary = z.object({
	type: z.enum(SHAREABLE_ELEMENT_TYPES),
	id: z.string(),
	name: z.string(),
	workspaceId: z.string(),
	/** The caller's role: the stronger of workspace and shared role. */
	role: z.enum(ELEMENT_ROLES),
});
export type ElementSummary = z.infer<typeof elementSummary>;

export function toElementSummary(
	element: ElementRecord,
	role: ElementRole,
): ElementSummary {
	return {
		type: element.type,
		id: element.id,
		name: element.name,
		workspaceId: element.workspaceId.toHexString(),
		role,
	};
}

export const shareView = z.object({
	id: z.string(),
	/** The account the element is shared with, `null` for an email share. */
	userId: z.string().nullable(),
	/** Email of a share to an address without an account (managers only). */
	email: z.string().nullable(),
	username: z.string().nullable(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
	role: z.enum(ELEMENT_ROLES),
});
export type ShareView = z.infer<typeof shareView>;

export const elementAccessView = z.object({
	/** Everyone in it holds a role on the element; `null` if it is gone. */
	workspace: z
		.object({
			id: z.string(),
			name: z.string(),
			type: z.enum(WORKSPACE_TYPES),
			memberCount: z.number().int(),
		})
		.nullable(),
	shares: z.array(shareView),
});
export type ElementAccessView = z.infer<typeof elementAccessView>;

interface StoredProfile {
	sub: string;
	username: string;
	name?: string | null;
	picture?: string | null;
}

/** Views of shares, their accounts loaded in one query. */
export async function toShareViews(
	rows: readonly StoredElementRole[],
	showEmails: boolean,
): Promise<ShareView[]> {
	const subs = rows.flatMap((row) => (row.userId ? [row.userId] : []));
	const users = await UserModel.find({ sub: { $in: subs } })
		.select("sub username name picture")
		.lean<StoredProfile[]>();
	const bySub = new Map(users.map((user) => [user.sub, user]));
	return rows.map((row) => {
		const user = row.userId ? bySub.get(row.userId) : undefined;
		return {
			id: row._id.toHexString(),
			userId: row.userId ?? null,
			email: showEmails ? (row.email ?? null) : null,
			username: user?.username ?? null,
			name: user?.name ?? null,
			picture: user?.picture ?? null,
			role: row.role,
		};
	});
}

/**
 * "Manage access" of an element: the workspace whose members hold a role
 * on it, and the people it is shared with, oldest share first.
 */
export async function elementAccessList(
	element: ElementRecord,
	showEmails: boolean,
): Promise<ElementAccessView> {
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	const memberCount =
		workspace?.type === "team"
			? await WorkspaceMemberModel.countDocuments({
					workspaceId: workspace._id,
					status: "accepted",
				})
			: 1;
	const rows = await ElementRoleModel.find({
		elementType: element.type,
		elementId: element.id,
	})
		.sort({ createdAt: 1, _id: 1 })
		.lean<StoredElementRole[]>();
	return {
		workspace: workspace
			? {
					id: workspace._id.toHexString(),
					name: workspace.name,
					type: workspace.type,
					memberCount,
				}
			: null,
		shares: await toShareViews(rows, showEmails),
	};
}

/** Where a notification about the element links to in the web app. */
export function elementPath(element: ElementRecord): string {
	return `/elements/${element.type}/${encodeURIComponent(element.id)}`;
}
