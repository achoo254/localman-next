/** How a tab's send fills `{{response …}}`: finding and sending its sources. */
import type {
	ClientResponse,
	ResolverLayer,
} from "@localman/shared/api-client";
import {
	type NamedRequest,
	type ReferenceOutcome,
	type ReferenceSteps,
	referenceScope,
} from "./response-reference-step";
import type { RequestNamed, SendHooks } from "./send-hooks";
import type { RequestSender } from "./send-types";
import type { SendContext } from "./workbench-tab-types";
import type { WorkbenchTab } from "./workbench-types";

class SourceFailed extends Error {}

/**
 * Steps for the references of `tab`: a source request is sent as its own
 * tab would be (the collection's auth, scripts and variables), within the
 * same cancellation.
 */
interface StepDeps {
	readonly hooks: SendHooks;
	readonly sender: RequestSender;
	readonly signal: AbortSignal;
	readonly variablesFor: (
		tab: WorkbenchTab,
		context: SendContext | null,
	) => Promise<readonly ResolverLayer[] | undefined | symbol>;
}

export const NO_REFERENCES: ReferenceOutcome = { ok: true, scope: null };

/** The references of `tab` filled in, or why not; none without the hook. */
export function referencesOf(
	tab: WorkbenchTab,
	hooks: SendHooks,
	deps: Omit<StepDeps, "hooks">,
): Promise<ReferenceOutcome> {
	const requestNamed = hooks.requestNamed;
	if (!requestNamed) return Promise.resolve(NO_REFERENCES);
	const steps = referenceSteps(tab, requestNamed, { ...deps, hooks });
	return referenceScope(tab.draft, tab.source, steps);
}

function referenceSteps(
	tab: WorkbenchTab,
	requestNamed: RequestNamed,
	deps: StepDeps,
): ReferenceSteps {
	return {
		find: requestNamed,
		send: async (request: NamedRequest, extra): Promise<ClientResponse> => {
			const source: WorkbenchTab = {
				...tab,
				draft: request.draft,
				source: request.source,
			};
			const found = await deps.hooks.sendContext?.(source);
			if (found && "unavailable" in found) throw new SourceFailed();
			const context = found?.context ?? null;
			const variables = await deps.variablesFor(source, context);
			if (typeof variables === "symbol") throw new SourceFailed();
			const settled = await deps.sender({
				draft: request.draft,
				files: new Map(),
				signal: deps.signal,
				...(context ? { context } : {}),
				...(variables ? { variables } : {}),
				...(extra ? { extraScopes: [extra] } : {}),
			});
			if (settled.kind !== "done") throw new SourceFailed();
			return settled.result.response;
		},
	};
}
