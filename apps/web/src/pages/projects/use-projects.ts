import {
	type UseQueryResult,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { type Project, fetchProjects } from "./projects-api";

/** Cache entry of the `/projects` list (the detail page uses `["projects", id, …]`). */
export const projectsKey = ["projects", "list"] as const;

export function useProjects(): UseQueryResult<Project[]> {
	return useQuery({ queryKey: projectsKey, queryFn: fetchProjects });
}

/** Edits the cached list in place (after create, edit, clone, delete…). */
export function useSetProjects(): (
	update: (list: Project[]) => Project[],
) => void {
	const client = useQueryClient();
	return useCallback(
		(update) =>
			client.setQueryData<Project[]>(projectsKey, (list) =>
				list ? update(list) : list,
			),
		[client],
	);
}

export type ProjectsState =
	| { status: "loading" }
	/** `refreshing`: a refetch runs while the list stays on screen. */
	| { status: "ready"; projects: Project[]; refreshing: boolean }
	/** `retrying`: the user pressed "Try again" and the request runs. */
	| { status: "error"; error: unknown; retrying: boolean };

/** What the list shows for a query: data wins over a failed refetch. */
export function projectsState(query: UseQueryResult<Project[]>): ProjectsState {
	if (query.data) {
		return {
			status: "ready",
			projects: query.data,
			refreshing: query.isFetching,
		};
	}
	if (query.isError) {
		return { status: "error", error: query.error, retrying: query.isFetching };
	}
	return { status: "loading" };
}

/** The list with one project's member count changed. */
export function withMemberCount(
	list: Project[],
	id: string,
	memberCount: number,
): Project[] {
	const project = list.find((p) => p.id === id);
	if (!project || project.memberCount === memberCount) return list;
	return list.map((p) => (p.id === id ? { ...p, memberCount } : p));
}
