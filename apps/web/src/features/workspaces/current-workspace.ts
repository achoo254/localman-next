import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { useCurrentUser } from "../auth/use-current-user";
import { type Workspace, fetchWorkspaces } from "./workspaces-api";

/** Query key of the caller's workspace list; members live under it. */
export const WORKSPACES_KEY = ["workspaces"] as const;
export const membersKey = (workspaceId: string) =>
	[...WORKSPACES_KEY, workspaceId, "members"] as const;

/**
 * Workspace picked in the switcher, remembered in this browser for each
 * account (`localman-workspace:<sub>`), so a second account signing in on
 * the same browser does not inherit the first one's choice.
 */
export const workspaceStorageKey = (sub: string): string =>
	`localman-workspace:${sub}`;

// Choices read from storage, by account. Kept in memory too, so a choice
// holds for this page view when storage is unavailable (privacy mode).
const selected = new Map<string, string | null>();
const listeners = new Set<() => void>();

function readSelection(sub: string | null): string | null {
	if (sub === null) return null;
	if (!selected.has(sub)) {
		try {
			selected.set(sub, window.localStorage.getItem(workspaceStorageKey(sub)));
		} catch {
			selected.set(sub, null);
		}
	}
	return selected.get(sub) ?? null;
}

function saveSelection(sub: string, workspaceId: string): void {
	selected.set(sub, workspaceId);
	try {
		window.localStorage.setItem(workspaceStorageKey(sub), workspaceId);
	} catch {
		// Storage unavailable: the choice still applies for this page view.
	}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Tests: forget the in-memory choices so the next read hits storage. */
export function resetWorkspaceSelection(): void {
	selected.clear();
}

function useAccountSub(): string | null {
	const session = useCurrentUser();
	return session.status === "authenticated" ? session.user.sub : null;
}

/** Makes a workspace the current one for the signed-in account. */
export function useSelectWorkspace(): (workspaceId: string) => void {
	const sub = useAccountSub();
	return useCallback(
		(workspaceId: string) => {
			if (sub) saveSelection(sub, workspaceId);
		},
		[sub],
	);
}

/** The caller's workspaces (cached for the whole app). */
export function useWorkspaces() {
	return useQuery({
		queryKey: WORKSPACES_KEY,
		queryFn: fetchWorkspaces,
		staleTime: 30_000,
	});
}

/** The saved workspace when it is still in the list, else the personal one. */
export function resolveCurrent(
	items: readonly Workspace[],
	savedId: string | null,
): Workspace | null {
	return (
		items.find((w) => w.id === savedId) ??
		items.find((w) => w.type === "personal") ??
		items[0] ??
		null
	);
}

/**
 * Current workspace of the API client. A saved workspace that is not in
 * the list (deleted, left, or not loaded yet) reads as the personal one;
 * the fallback is never saved, so a list fetched a moment later (just
 * after joining a workspace) still finds the saved choice.
 */
export function useCurrentWorkspace() {
	const query = useWorkspaces();
	const sub = useAccountSub();
	const select = useSelectWorkspace();
	const savedId = useSyncExternalStore(
		subscribe,
		() => readSelection(sub),
		() => null,
	);
	const items = query.data ?? null;
	const current = items ? resolveCurrent(items, savedId) : null;
	return { query, workspaces: items, current, select };
}

/**
 * After leaving or deleting a workspace: back to the personal one, and the
 * list (and every member list) is fetched again.
 */
export function useForgetWorkspace() {
	const client = useQueryClient();
	const select = useSelectWorkspace();
	return useCallback(
		async (workspaceId: string) => {
			const items = client.getQueryData<Workspace[]>(WORKSPACES_KEY) ?? [];
			const personal = items.find((w) => w.type === "personal");
			if (personal) select(personal.id);
			client.removeQueries({ queryKey: membersKey(workspaceId) });
			await client.invalidateQueries({ queryKey: WORKSPACES_KEY });
		},
		[client, select],
	);
}
