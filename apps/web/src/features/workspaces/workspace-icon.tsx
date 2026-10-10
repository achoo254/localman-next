import type { WorkspaceType } from "@localman/shared/access";
import { IconUser, IconUsers } from "@tabler/icons-react";

/** A person for a personal workspace, a group for a team one. */
export function WorkspaceIcon({
	type,
	size = 16,
}: {
	type: WorkspaceType;
	size?: number;
}) {
	const Icon = type === "personal" ? IconUser : IconUsers;
	return <Icon size={size} aria-hidden="true" className="shrink-0" />;
}
