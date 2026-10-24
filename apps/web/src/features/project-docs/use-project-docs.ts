import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFeatures } from "../../config/features";
import {
	fetchDocsSettings,
	fetchPublicDocs,
	setDocsPublished,
} from "./project-docs-api";

const settingsKey = (projectId: string) =>
	["projectDocs", "settings", projectId] as const;

export function useProjectDocsEnabled(): boolean {
	return useFeatures().projectDocs;
}

export function useDocsSettings(projectId: string, enabled: boolean) {
	return useQuery({
		queryKey: settingsKey(projectId),
		queryFn: () => fetchDocsSettings(projectId),
		enabled,
	});
}

export function useSetDocsPublished(projectId: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (published: boolean) => setDocsPublished(projectId, published),
		onSuccess: (settings) =>
			client.setQueryData(settingsKey(projectId), settings),
	});
}

export function usePublicDocs(slug: string) {
	return useQuery({
		queryKey: ["projectDocs", "public", slug],
		queryFn: () => fetchPublicDocs(slug),
		retry: false,
	});
}
