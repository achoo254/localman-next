import { useCallback, useEffect, useState } from "react";
import { appPageUrl } from "../../platform/navigation";
import { fetchCollaborators } from "./collaborators-api";
import {
	type MagicLinkState,
	createMagicLink,
	fetchMagicLink,
	revokeMagicLink,
} from "./magic-link-api";

export type MagicLinkView =
	| { status: "loading" }
	| { status: "error"; error: unknown }
	| {
			status: "ready";
			link: MagicLinkState;
			/** Full URL right after creating it; null once it can't be shown. */
			created: string | null;
	  };

export interface Seats {
	used: number;
	max: number | null;
}

/**
 * Magic link of a project for its dialog, with the member seats (the link
 * holds no seat, but joining fails while the project is full). Seats are
 * best effort: the link state works without them.
 */
export function useMagicLink(projectId: string) {
	const [view, setView] = useState<MagicLinkView>({ status: "loading" });
	const [seats, setSeats] = useState<Seats | null>(null);
	const [creating, setCreating] = useState(false);

	const load = useCallback(async () => {
		setView({ status: "loading" });
		const seatsRequest = fetchCollaborators(projectId).then(
			(list) => list.seats,
			() => null,
		);
		try {
			const link = await fetchMagicLink(projectId);
			setView({ status: "ready", link, created: null });
		} catch (error) {
			setView({ status: "error", error });
		}
		setSeats(await seatsRequest);
	}, [projectId]);

	useEffect(() => {
		void load();
	}, [load]);

	/** Rejects on failure, so a confirmation dialog can show the error. */
	async function regenerate() {
		const created = await createMagicLink(projectId);
		setView({
			status: "ready",
			link: created,
			created: appPageUrl(created.link),
		});
	}

	/** Creates without confirmation (no working link to replace). */
	async function create() {
		setCreating(true);
		try {
			await regenerate();
		} catch (error) {
			setView({ status: "error", error });
		} finally {
			setCreating(false);
		}
	}

	async function revoke() {
		const link = await revokeMagicLink(projectId);
		setView({ status: "ready", link, created: null });
	}

	return { view, seats, creating, load, create, regenerate, revoke };
}
