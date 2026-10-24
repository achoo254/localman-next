/**
 * The caller's own values of a collection's variables (environments flag
 * on): never synced, used instead of the shared value when they send.
 * Any role may set them, Viewers included.
 */
import type { LocalValue } from "@localman/shared/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { LocalValueWrite } from "../environments/local-values-api";
import {
	collectionLocalKey,
	useCollectionLocalValues,
} from "../environments/use-environments";
import {
	collectionLocalTarget,
	setCollectionLocalValues,
} from "../environments/variable-scopes-api";
import {
	agentCopyKeys,
	withAgentCopies,
} from "../secure-vault/agent-use/agent-copy";
import { useResealLegacy } from "../secure-vault/use-reseal-legacy";
import {
	collectionScope,
	openLocalValues,
	useVaultValues,
} from "../secure-vault/vault-codec";
import { VaultLockedError } from "../secure-vault/vault-session";
import { collectionErrorMessage } from "./collection-errors";

export interface CollectionLocal {
	/** The values are loaded (only then can they change). */
	ready: boolean;
	/** The caller's value of `key`, `null` when they use the shared one. */
	valueOf: (key: string) => string | null;
	/** The caller's value of `key` is locked in the vault (unreadable now). */
	lockedOf: (key: string) => boolean;
	/** Locked for good: sealed by another vault (replace or remove it). */
	unreadableOf: (key: string) => boolean;
	/** `null` goes back to the shared value. */
	save: (key: string, value: string | null) => void;
	/** A renamed variable: its own value follows (unless the name has one). */
	move: (from: string, to: string) => void;
}

/**
 * `collectionId` is `null` while local values are off. `secretKeys`: the
 * variables flagged secret, whose values the vault encrypts. `agentKeys`:
 * those the caller lets agents use; a new value of one carries its copy.
 */
export function useCollectionLocal(
	collectionId: string | null,
	secretKeys: ReadonlySet<string> = new Set(),
	agentKeys: ReadonlySet<string> = new Set(),
): CollectionLocal {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	const query = useCollectionLocalValues(collectionId);
	const mutation = useMutation({
		// One at a time, in order: a late answer never overwrites a newer one.
		scope: { id: `collection-local-${collectionId ?? ""}` },
		mutationFn: (writes: LocalValueWrite[]) =>
			setCollectionLocalValues(
				collectionId ?? "",
				withAgentCopies(
					writes,
					// The server's word on each value counts before the uses load.
					new Set([...agentKeys, ...agentCopyKeys(query.data ?? [], null)]),
					secretKeys,
				),
				secretKeys,
			),
		onSuccess: (values) =>
			client.setQueryData(collectionLocalKey(collectionId ?? ""), values),
		onError: (error) =>
			toast.show(
				error instanceof VaultLockedError
					? { tone: "info", title: t("agentUse.vault.saveLockedTitle") }
					: { tone: "error", title: collectionErrorMessage(error, t) },
			),
	});
	const localKey = collectionLocalKey(collectionId ?? "");
	useResealLegacy(
		collectionId ? collectionLocalTarget(collectionId, secretKeys) : null,
		query.data ?? [],
		() => client.getQueryData<LocalValue[]>(localKey),
		(values) => client.setQueryData(localKey, values),
	);
	useVaultValues();
	const opened = collectionId
		? openLocalValues(collectionScope(collectionId), query.data ?? [])
		: [];
	// A value locked in the vault reads as none here and cannot move.
	const values = new Map(
		opened.filter((v) => !v.locked).map((v) => [v.key, v.value]),
	);
	return {
		ready: query.isSuccess,
		valueOf: (key) => values.get(key) ?? null,
		lockedOf: (key) =>
			opened.some((v) => v.key === key && v.locked && !v.unreadable),
		unreadableOf: (key) =>
			opened.some((v) => v.key === key && v.unreadable === true),
		save: (key, value) => mutation.mutate([{ key, value }]),
		move: (from, to) => {
			const value = values.get(from);
			if (!from || !to || from === to || value === undefined) return;
			// Never onto a name that has a value, readable or locked.
			if (values.has(to) || opened.some((v) => v.key === to)) return;
			mutation.mutate([
				{ key: to, value },
				{ key: from, value: null },
			]);
		},
	};
}
