/**
 * The caller's own values of a collection's variables (environments flag
 * on): never synced, used instead of the shared value when they send.
 * Any role may set them, Viewers included.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { LocalValueWrite } from "../environments/environments-api";
import {
	collectionLocalKey,
	useCollectionLocalValues,
} from "../environments/use-environments";
import { setCollectionLocalValues } from "../environments/variable-scopes-api";
import { collectionErrorMessage } from "./collection-errors";

export interface CollectionLocal {
	/** The values are loaded (only then can they change). */
	ready: boolean;
	/** The caller's value of `key`, `null` when they use the shared one. */
	valueOf: (key: string) => string | null;
	/** `null` goes back to the shared value. */
	save: (key: string, value: string | null) => void;
	/** A renamed variable: its own value follows (unless the name has one). */
	move: (from: string, to: string) => void;
}

/** `collectionId` is `null` while local values are off. */
export function useCollectionLocal(
	collectionId: string | null,
): CollectionLocal {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	const query = useCollectionLocalValues(collectionId);
	const mutation = useMutation({
		// One at a time, in order: a late answer never overwrites a newer one.
		scope: { id: `collection-local-${collectionId ?? ""}` },
		mutationFn: (writes: LocalValueWrite[]) =>
			setCollectionLocalValues(collectionId ?? "", writes),
		onSuccess: (values) =>
			client.setQueryData(collectionLocalKey(collectionId ?? ""), values),
		onError: (error) =>
			toast.show({ tone: "error", title: collectionErrorMessage(error, t) }),
	});
	const values = new Map((query.data ?? []).map((v) => [v.key, v.value]));
	return {
		ready: query.isSuccess,
		valueOf: (key) => values.get(key) ?? null,
		save: (key, value) => mutation.mutate([{ key, value }]),
		move: (from, to) => {
			const value = values.get(from);
			if (!from || !to || from === to || value === undefined) return;
			if (values.has(to)) return;
			mutation.mutate([
				{ key: to, value },
				{ key: from, value: null },
			]);
		},
	};
}
