import { useQuery } from "@tanstack/react-query";
import { fetchProject } from "../projects/projects-api";

/** One project by id; `data` is null when it is missing or not readable. */
export function useProject(projectId: string) {
	return useQuery({
		queryKey: ["project", projectId],
		queryFn: () => fetchProject(projectId),
	});
}
