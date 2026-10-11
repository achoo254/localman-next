/**
 * Autosave of a collection or folder page: edits show at once (over the
 * stored values), go out together once typing pauses for `delayMs`, and
 * right away on `flush` (Ctrl/Cmd+S, leaving the page). Saves run one
 * after another, each taking what is queued when its turn comes, so
 * answers arrive in order and an older one never overwrites a newer one.
 * A failed save keeps its edits for the next try, unless newer ones
 * replaced them. `discard` drops what is not sent yet (after a restore).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_SAVE_DELAY_MS = 800;

export type SaveStatus =
	| { state: "idle" }
	| { state: "saving" }
	| { state: "saved" }
	| { state: "error"; error: unknown };

function withoutSent<P extends object>(
	pending: Partial<P>,
	sent: Partial<P>,
): Partial<P> {
	const next = { ...pending };
	for (const key of Object.keys(sent)) {
		if (Reflect.get(next, key) === Reflect.get(sent, key)) {
			Reflect.deleteProperty(next, key);
		}
	}
	return next;
}

export function usePageAutosave<P extends object>(
	save: (patch: Partial<P>) => Promise<void>,
	delayMs = PAGE_SAVE_DELAY_MS,
) {
	const [pending, setPending] = useState<Partial<P>>({});
	const [status, setStatus] = useState<SaveStatus>({ state: "idle" });
	const pendingRef = useRef(pending);
	pendingRef.current = pending;
	const queued = useRef<Partial<P>>({});
	const timer = useRef<number | undefined>(undefined);
	const saveRef = useRef(save);
	saveRef.current = save;
	const chain = useRef<Promise<void>>(Promise.resolve());

	const saveQueued = useCallback(async (): Promise<void> => {
		const patch = queued.current;
		if (Object.keys(patch).length === 0) return;
		queued.current = {};
		setStatus({ state: "saving" });
		try {
			await saveRef.current(patch);
			setPending((current) => withoutSent(current, patch));
			setStatus({ state: "saved" });
		} catch (error) {
			// Edits made meanwhile win over the ones that failed.
			queued.current = { ...patch, ...queued.current };
			setStatus({ state: "error", error });
		}
	}, []);

	const flush = useCallback((): Promise<void> => {
		window.clearTimeout(timer.current);
		chain.current = chain.current.then(saveQueued);
		return chain.current;
	}, [saveQueued]);

	const edit = useCallback(
		(change: Partial<P>) => {
			queued.current = { ...queued.current, ...change };
			setPending((current) => ({ ...current, ...change }));
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => void flush(), delayMs);
		},
		[flush, delayMs],
	);

	/** Drops edits not saved yet from the page; `true` when there were some. */
	const discard = useCallback((): boolean => {
		window.clearTimeout(timer.current);
		const had =
			Object.keys(queued.current).length > 0 ||
			Object.keys(pendingRef.current).length > 0;
		queued.current = {};
		setPending({});
		setStatus({ state: "idle" });
		return had;
	}, []);

	// Leaving the page saves what waits.
	useEffect(() => () => void flush(), [flush]);

	return { pending, edit, flush, discard, status };
}
