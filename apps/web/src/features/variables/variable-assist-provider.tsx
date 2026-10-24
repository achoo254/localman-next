import type { ResolverLayer } from "@localman/shared/api-client";
import { type ReactNode, useMemo } from "react";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { AssistPopups } from "./assist-popups";
import { useApplyVariable } from "./use-apply-variable";
import { useAssistPopups } from "./use-assist-popups";
import { useReferenceRequests } from "./use-reference-requests";
import { useResponseSelection } from "./use-response-selection";
import { useVariableScopes } from "./use-variable-scopes";
import {
	VariableAssistActionsContext,
	type VariableAssistData,
	VariableAssistDataContext,
} from "./variable-assist-context";
import { dynamicVariableNames, variableClassifier } from "./variable-kinds";
import { type VariableTargets, scopeChoices } from "./variable-targets";

export interface VariableAssistProviderProps {
	/** The open request tab: its scopes and temporary variables. */
	tab: WorkbenchTab;
	/** Its request editor and response. */
	children: ReactNode;
}

const NO_LAYERS: readonly ResolverLayer[] = [];
const noKeptResponse = () => undefined;
const NO_TARGETS: VariableTargets = {
	workspaceId: null,
	environment: null,
	collection: null,
	globals: null,
};

/**
 * The variable assist of a request tab while environments are on:
 * coloured `{{name}}`s with their hover card, `{{` suggestions, and
 * "Set as variable" from the request editors or the response body. Off,
 * the children render as they would without it.
 */
export function VariableAssistProvider({
	tab,
	children,
}: VariableAssistProviderProps) {
	const scopes = useVariableScopes(tab);
	const layers = scopes?.layers ?? NO_LAYERS;
	const targets = scopes?.targets ?? NO_TARGETS;
	const references = useReferenceRequests(tab);
	const popups = useAssistPopups(layers, references?.suggest);
	const apply = useApplyVariable(tab.id, targets);
	const choices = useMemo(() => scopeChoices(targets), [targets]);
	const referenceNames = references?.names ?? null;
	const data = useMemo<VariableAssistData | null>(
		() =>
			scopes
				? {
						layers,
						classify: variableClassifier(
							layers,
							dynamicVariableNames(),
							referenceNames,
						),
					}
				: null,
		[scopes, layers, referenceNames],
	);
	useResponseSelection(popups.actions, data !== null);

	return (
		<VariableAssistActionsContext value={data ? popups.actions : null}>
			<VariableAssistDataContext value={data}>
				{children}
				{data ? (
					<AssistPopups
						popups={popups}
						layers={layers}
						classify={data.classify}
						choices={choices}
						targets={targets}
						apply={apply}
						keptFor={references?.keptFor ?? noKeptResponse}
					/>
				) : null}
			</VariableAssistDataContext>
		</VariableAssistActionsContext>
	);
}
