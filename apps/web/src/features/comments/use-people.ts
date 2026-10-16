import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { membersKey } from "../workspaces/current-workspace";
import { fetchWorkspaceMembers } from "../workspaces/workspace-members-api";
import type { MentionCandidate } from "./mention-suggestions";

/**
 * Members of the workspace, offered after `@`; anyone else who can open
 * the collection can still be mentioned by typing their username.
 */
export function usePeople(workspaceId: string | null): MentionCandidate[] {
	const members = useQuery({
		queryKey: membersKey(workspaceId ?? ""),
		queryFn: () => fetchWorkspaceMembers(workspaceId ?? ""),
		enabled: workspaceId !== null,
		staleTime: 60_000,
	});
	return useMemo(
		() =>
			(members.data?.members ?? []).map((member) => ({
				username: member.username,
				name: member.name,
			})),
		[members.data],
	);
}
