import { useMemo } from "react";
import type { ShareableEnvironment } from "../sharing/share-people-form";
import { useEnvironmentList } from "./use-environments";
import { useEnvironmentsEnabled } from "./use-environments-enabled";

const NONE: readonly ShareableEnvironment[] = [];

/**
 * Environments of the workspace a collection can be shared together with:
 * those the caller may share (Editor role); none while the flag is off.
 */
export function useShareableEnvironments(
	workspaceId: string,
): readonly ShareableEnvironment[] {
	const enabled = useEnvironmentsEnabled();
	const list = useEnvironmentList(enabled ? workspaceId : null);
	return useMemo(
		() =>
			list.data
				?.filter((env) => env.role === "editor")
				.map((env) => ({ id: env.id, name: env.name })) ?? NONE,
		[list.data],
	);
}
