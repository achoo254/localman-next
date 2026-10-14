import type { CollectionLinkKind } from "@localman/shared/api-client";
import { useQuery } from "@tanstack/react-query";
import { fetchAccessKeys } from "./access-keys-api";
import {
	fetchCollectionLink,
	fetchGuestCollection,
	fetchPublicCollection,
} from "./collection-links-api";
import { fetchRunButtons, previewRunButton } from "./run-buttons-api";
import { fetchWorkspaceSharing } from "./workspace-sharing-api";

/** Everything public sharing caches for one collection lives under it. */
const collectionKey = (collectionId: string) =>
	["public-sharing", "collection", collectionId] as const;

export const collectionLinkKey = (
	collectionId: string,
	kind: CollectionLinkKind,
) => [...collectionKey(collectionId), "link", kind] as const;
export const accessKeysKey = (collectionId: string) =>
	[...collectionKey(collectionId), "access-keys"] as const;
export const runButtonsKey = (collectionId: string) =>
	[...collectionKey(collectionId), "run-buttons"] as const;
export const workspaceSharingKey = (workspaceId: string) =>
	["workspaces", workspaceId, "sharing"] as const;

export function useCollectionLink(
	collectionId: string,
	kind: CollectionLinkKind,
) {
	return useQuery({
		queryKey: collectionLinkKey(collectionId, kind),
		queryFn: () => fetchCollectionLink(collectionId, kind),
	});
}

export function useAccessKeys(collectionId: string) {
	return useQuery({
		queryKey: accessKeysKey(collectionId),
		queryFn: () => fetchAccessKeys(collectionId),
	});
}

export function useRunButtons(collectionId: string) {
	return useQuery({
		queryKey: runButtonsKey(collectionId),
		queryFn: () => fetchRunButtons(collectionId),
	});
}

export function useWorkspaceSharing(workspaceId: string) {
	return useQuery({
		queryKey: workspaceSharingKey(workspaceId),
		queryFn: () => fetchWorkspaceSharing(workspaceId),
	});
}

/** The page a public link opens; 404 and 429 are answers, not retried. */
export function usePublicCollection(linkId: string) {
	return useQuery({
		queryKey: ["public-sharing", "public-view", linkId],
		queryFn: () => fetchPublicCollection(linkId),
	});
}

export function useGuestCollection(linkId: string) {
	return useQuery({
		queryKey: ["public-sharing", "guest-view", linkId],
		queryFn: () => fetchGuestCollection(linkId),
	});
}

/** `enabled` stays off until the visitor is signed in. */
export function useRunButtonPreview(buttonId: string, enabled: boolean) {
	return useQuery({
		queryKey: ["public-sharing", "run-preview", buttonId],
		queryFn: () => previewRunButton(buttonId),
		enabled,
	});
}
