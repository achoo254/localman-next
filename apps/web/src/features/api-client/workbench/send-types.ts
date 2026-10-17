/** What a send takes and how a sender answers (`RequestSender`). */
import type {
	ApiRequestDraft,
	ResolverLayer,
	RouteMode,
	ScriptScopeChanges,
} from "@localman/shared/api-client";
import type { SendContext } from "./workbench-tab-types";
import type { SettledResponse } from "./workbench-types";

/** One-off choices for a single send (retry buttons of the response). */
export interface SendOptions {
	/** For this send only; the tab keeps its own. */
	route?: RouteMode;
	/** After a browser `TypeError`: a proxy success remembers the origin. */
	afterDirectBlocked?: boolean;
	/** "Check again": read the user's Tunelo tunnels anew, not cached. */
	refreshTunnels?: boolean;
}

export interface SendInput {
	draft: ApiRequestDraft;
	files: ReadonlyMap<string, File>;
	/** Aborted by "Cancel" or when the tab closes. */
	signal: AbortSignal;
	options?: SendOptions;
	/** `WorkbenchTab.routeChosen`; `options.route` counts as chosen too. */
	routeChosen?: boolean;
	/** Auth, scripts and variables from the collection of a bound tab. */
	context?: SendContext;
	/** Globals, collection and environment with local values (flag on). */
	variables?: readonly ResolverLayer[];
	/** Told what the scripts changed in the scopes so far (to save them). */
	onScopeChanges?: (changes: ScriptScopeChanges) => void;
}

/**
 * Sends one request, scripts included. Never rejects: every failure comes
 * back as `{ kind: "failed" }`, an abort as `{ kind: "cancelled" }`.
 */
export type RequestSender = (input: SendInput) => Promise<SettledResponse>;
