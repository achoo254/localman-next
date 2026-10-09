import { useCallback, useEffect, useRef, useState } from "react";
import {
	type Collaborator,
	type CollaboratorList,
	fetchCollaborators,
	removeCollaborator,
} from "./collaborators-api";

/** Fallback when no `transitionend` arrives (jsdom, hidden tab): 200ms + slack. */
export const LEAVE_FALLBACK_MS = 250;

export type CollaboratorsState =
	| { status: "loading" }
	| { status: "error"; error: unknown }
	| { status: "ready"; list: CollaboratorList };

/** Pending and accepted rows hold a member seat; expired ones do not. */
const seatOf = (item: Collaborator | undefined): number =>
	item && item.status !== "expired" ? 1 : 0;

/** Owner plus accepted members, as the project list's `memberCount`. */
export function memberCountOf(list: CollaboratorList): number {
	return 1 + list.items.filter((item) => item.status === "accepted").length;
}

/**
 * Members of a project for the collaborators dialog.
 * - `add` upserts by id: inviting the same person again reuses their row.
 * - `remove` ignores a second call for a row already being removed; the
 *   row then folds away (`leaving`), `beforeGone` runs and it is dropped.
 * - `load({ background: true })` refreshes without hiding the list.
 */
export function useCollaborators(
	projectId: string,
	beforeGone: (id: string) => void,
) {
	const [state, setState] = useState<CollaboratorsState>({
		status: "loading",
	});
	const [refreshing, setRefreshing] = useState(false);
	const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
	const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
	// Sources of truth for the two sets, so repeated calls stay idempotent.
	const leavingRef = useRef(new Set<string>());
	const removingRef = useRef(new Set<string>());
	const timers = useRef(new Set<number>());
	const beforeGoneRef = useRef(beforeGone);
	useEffect(() => {
		beforeGoneRef.current = beforeGone;
	});

	const update = useCallback(
		(change: (list: CollaboratorList) => CollaboratorList) => {
			setState((current) =>
				current.status === "ready"
					? { status: "ready", list: change(current.list) }
					: current,
			);
		},
		[],
	);

	const load = useCallback(
		async ({ background = false }: { background?: boolean } = {}) => {
			if (background) setRefreshing(true);
			else setState({ status: "loading" });
			try {
				const list = await fetchCollaborators(projectId);
				setState({ status: "ready", list });
			} catch (error) {
				// A failed background refresh keeps what is on screen.
				if (!background) setState({ status: "error", error });
			} finally {
				if (background) setRefreshing(false);
			}
		},
		[projectId],
	);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const timer of pending) window.clearTimeout(timer);
		};
	}, []);

	const drop = useCallback(
		(id: string) => {
			const current = leavingRef.current;
			if (!current.has(id)) return;
			current.delete(id);
			beforeGoneRef.current(id);
			update((list) => ({
				...list,
				items: list.items.filter((item) => item.id !== id),
			}));
			setLeaving(new Set(current));
		},
		[update],
	);

	/** New or reused invitation row; the server may also drop duplicates. */
	function add(item: Collaborator) {
		update((list) => {
			const old = list.items.find((row) => row.id === item.id);
			const items = old
				? list.items.map((row) => (row.id === item.id ? item : row))
				: [...list.items, item];
			const used = list.seats.used + seatOf(item) - seatOf(old);
			return { ...list, seats: { ...list.seats, used }, items };
		});
		void load({ background: true });
	}

	function setRemovingIds() {
		setRemoving(new Set(removingRef.current));
	}

	/**
	 * Deletes on the server, frees the seat, then folds the row away.
	 * Returns false when the row was already being removed.
	 */
	async function remove(item: Collaborator): Promise<boolean> {
		if (removingRef.current.has(item.id)) return false;
		removingRef.current.add(item.id);
		setRemovingIds();
		try {
			await removeCollaborator(projectId, item.id);
		} catch (error) {
			removingRef.current.delete(item.id);
			setRemovingIds();
			throw error;
		}
		update((list) => ({
			...list,
			seats: { ...list.seats, used: list.seats.used - seatOf(item) },
		}));
		leavingRef.current.add(item.id);
		setLeaving(new Set(leavingRef.current));
		const timer = window.setTimeout(() => {
			timers.current.delete(timer);
			drop(item.id);
		}, LEAVE_FALLBACK_MS);
		timers.current.add(timer);
		return true;
	}

	return { state, refreshing, leaving, removing, load, add, remove, drop };
}
