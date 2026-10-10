import type { AnyOperation } from "@localman/operations";
import { workspaceCrudOperations } from "./workspace-crud-operations.js";
import { workspaceInviteOperations } from "./workspace-invite-operations.js";
import { workspaceInviteTokenOperations } from "./workspace-invite-token-operations.js";
import { workspaceMemberOperations } from "./workspace-member-operations.js";

/** Workspace, member and invitation operations (registered in the registry). */
export const workspaceOperations: readonly AnyOperation[] = [
	...workspaceCrudOperations,
	...workspaceMemberOperations,
	...workspaceInviteOperations,
	...workspaceInviteTokenOperations,
];
