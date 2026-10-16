/**
 * Hands a readable element over to the workbench: once the session and
 * the caller's workspaces are known, switches to the element's workspace
 * when they are a member of it (someone it was shared with directly keeps
 * their current one), then goes to `/api-client` with the element's ids
 * as navigation state.
 */
import type { ShareableElementType } from "@localman/shared/access";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { reloadCurrentUser, useCurrentUser } from "../auth/use-current-user";
import {
	useSelectWorkspace,
	useWorkspaces,
} from "../workspaces/current-workspace";
import { openElementState } from "./open-element-state";

export interface ElementLinkTarget {
	type: ShareableElementType;
	id: string;
	nodeId: string | null;
	/** A comment to bring into view (collections). */
	commentId: string | null;
	/** Known once the element loaded (the caller can read it). */
	workspaceId: string | null;
}

export interface OpenElementLink {
	/** The session could not be read: show it, with `retry`. */
	error: unknown;
	retry: () => void;
}

export function useOpenElementLink(
	target: ElementLinkTarget,
	enabled: boolean,
): OpenElementLink {
	const navigate = useNavigate();
	const session = useCurrentUser();
	const signedIn = session.status === "authenticated";
	const workspaces = useWorkspaces(signedIn && enabled);
	const selectWorkspace = useSelectWorkspace();
	const { type, id, nodeId, commentId, workspaceId } = target;
	// A failed list counts as "not a member": nothing is switched.
	const listed = workspaces.isSuccess || workspaces.isError;
	const member =
		workspaces.data?.some((workspace) => workspace.id === workspaceId) ?? false;
	useEffect(() => {
		if (!enabled || workspaceId === null || !signedIn || !listed) return;
		if (member) selectWorkspace(workspaceId);
		void navigate("/api-client", {
			replace: true,
			state: openElementState({
				type,
				id,
				...(nodeId ? { nodeId } : {}),
				...(commentId ? { commentId } : {}),
			}),
		});
	}, [
		enabled,
		workspaceId,
		signedIn,
		listed,
		member,
		selectWorkspace,
		navigate,
		type,
		id,
		nodeId,
		commentId,
	]);
	return {
		error: session.status === "error" ? session.error : null,
		retry: () => void reloadCurrentUser(),
	};
}
