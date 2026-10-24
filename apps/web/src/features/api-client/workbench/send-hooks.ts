/** What a send may use besides the sender: collection context, variables, saving script changes. */
import type {
	ResolverLayer,
	ScriptScopeChanges,
} from "@localman/shared/api-client";
import type { NamedRequest } from "./response-reference-step";
import type { SendContext } from "./workbench-tab-types";
import type { WorkbenchTab } from "./workbench-types";

/**
 * What a tab bound to a collection request inherits when sent. When its
 * collection (or the request in it) cannot be read, the send fails with
 * `unavailable`, the reason to show: sending it as a loose request would
 * drop its auth and scripts without a word.
 */
export type SendContextOf = (
	tab: WorkbenchTab,
) => Promise<{ context: SendContext } | { unavailable: string }>;

/**
 * The variable scopes a send resolves `{{name}}` from: globals, the
 * bound tab's collection and the active environment, each with the
 * caller's local values. `undefined` keeps the collection variables only.
 */
export type VariablesOf = (
	tab: WorkbenchTab,
	context: SendContext | null,
) => Promise<readonly ResolverLayer[] | undefined>;

/**
 * Called when a send starts: fixes where its scripts' changes to
 * `lm.globals`, `lm.collectionVariables` and `lm.environment` go (the
 * workspace and active environment of that moment), and returns the
 * function that saves them as the caller's local values (`true` when all
 * of it was saved).
 */
export type SaveScopes = (
	collectionId: string | null,
) => (changes: ScriptScopeChanges) => Promise<ScopeSaveResult>;

/**
 * `saved`: every change that had somewhere to go was saved. `dropped`:
 * scopes the scripts wrote with nowhere to keep it (no active environment,
 * a request outside any collection).
 */
export interface ScopeSaveResult {
	saved: boolean;
	dropped: ("environment" | "collectionVariables")[];
}

/**
 * The request of that name in a collection, for `{{response …}}`
 * references (`null` when there is none).
 */
export type RequestNamed = (
	collectionId: string,
	name: string,
) => Promise<NamedRequest | null>;

/** What a send may use besides the sender; all optional. */
export interface SendHooks {
	sendContext?: SendContextOf;
	variablesOf?: VariablesOf;
	saveScopes?: SaveScopes;
	requestNamed?: RequestNamed;
}
