import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "../../../lib/api-client";
import {
	type LinkedMachine,
	type Pairing,
	type PairingState,
	tuneloAccountsApi,
} from "./tunelo-accounts-api";
import { useLinksChanged } from "./use-tunnel-links";

/** How often the server is asked whether the machine approved. */
export const PAIRING_POLL_MS = 2_000;
/** Polls that fail in a row on a passing error before the modal gives up. */
export const PAIRING_POLL_RETRIES = 3;

/** Network down, rate limited or a server blip: worth asking again. */
function isTransient(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		(error.status === 0 || error.status === 429 || error.status >= 500)
	);
}

export type PairingView =
	| { step: "opening" }
	| { step: "waiting"; pairing: Pairing }
	| { step: "linked"; link: LinkedMachine }
	| { step: "expired" }
	| { step: "failed"; message: string };

/**
 * One `tunelo link` pairing while `active`: opens a code, polls until the
 * machine approves or the code expires. A passing error (network, 429,
 * 5xx) is retried a few times with backoff; a pairing the server no
 * longer has (404) reads as expired. Turning inactive (the modal closed)
 * stops polling and cancels a pairing still waiting.
 */
export function usePairing(active: boolean): {
	view: PairingView;
	restart: () => void;
} {
	const [view, setView] = useState<PairingView>({ step: "opening" });
	const [attempt, setAttempt] = useState(0);
	const changed = useLinksChanged();
	const changedRef = useRef(changed);
	changedRef.current = changed;

	// biome-ignore lint/correctness/useExhaustiveDependencies: each `attempt` (Get a new code) opens a new pairing.
	useEffect(() => {
		if (!active) return;
		let stopped = false;
		let waitingId: string | null = null;
		let timer: number | undefined;
		const fail = (error: unknown) => {
			if (!stopped) setView({ step: "failed", message: errorMessage(error) });
		};
		let errors = 0;
		const schedule = (pairing: Pairing, delay: number) => {
			timer = window.setTimeout(() => poll(pairing).catch(fail), delay);
		};
		const poll = async (pairing: Pairing) => {
			let state: PairingState;
			try {
				state = await tuneloAccountsApi.pollPairing(pairing.id);
				errors = 0;
			} catch (error) {
				if (stopped) return;
				// The pairing is gone: its code ran out (TTL) on the server.
				if (error instanceof ApiError && error.status === 404) {
					waitingId = null;
					return setView({ step: "expired" });
				}
				if (!isTransient(error) || errors >= PAIRING_POLL_RETRIES) {
					return fail(error);
				}
				errors += 1;
				return schedule(pairing, PAIRING_POLL_MS * 2 ** errors);
			}
			if (stopped) return;
			if (state.status === "pending") return schedule(pairing, PAIRING_POLL_MS);
			waitingId = null;
			if (state.status === "expired") return setView({ step: "expired" });
			setView({ step: "linked", link: state.link });
			changedRef.current();
		};
		setView({ step: "opening" });
		tuneloAccountsApi
			.startPairing()
			.then((pairing) => {
				if (stopped) {
					tuneloAccountsApi.deleteLink(pairing.id).catch(() => {});
					return;
				}
				waitingId = pairing.id;
				setView({ step: "waiting", pairing });
				schedule(pairing, PAIRING_POLL_MS);
			})
			.catch(fail);
		return () => {
			stopped = true;
			window.clearTimeout(timer);
			// Best effort: an abandoned pairing also expires on its own.
			if (waitingId) tuneloAccountsApi.deleteLink(waitingId).catch(() => {});
		};
	}, [active, attempt]);

	const restart = useCallback(() => setAttempt((value) => value + 1), []);
	return { view, restart };
}
