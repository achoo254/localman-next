/**
 * Variables of the scopes already loaded on this page (environments,
 * globals, collections), read from the query cache to suggest hosts in
 * "Let agents use": nothing is fetched for it.
 */
import type { QueryClient } from "@tanstack/react-query";
import { isRecord } from "../../../lib/json-guards";
import { COLLECTIONS_KEY } from "../../collections/use-collections";
import { ENVIRONMENTS_KEY } from "../../environments/use-environments";
import type { SuggestionSource } from "./agent-hosts";

const text = (value: unknown): string | null =>
	typeof value === "string" ? value : null;

function sourcesOf(data: unknown): SuggestionSource[] {
	if (!isRecord(data) || !Array.isArray(data.variables)) return [];
	return data.variables.flatMap((variable: unknown): SuggestionSource[] =>
		isRecord(variable) && typeof variable.key === "string"
			? [
					{
						key: variable.key,
						// Environments and globals name it sharedValue; collections value.
						values: [text(variable.sharedValue), text(variable.value)],
					},
				]
			: [],
	);
}

export function cachedHostSources(client: QueryClient): SuggestionSource[] {
	return [
		...client.getQueriesData({ queryKey: ENVIRONMENTS_KEY }),
		...client.getQueriesData({ queryKey: COLLECTIONS_KEY }),
	].flatMap(([, data]) => sourcesOf(data));
}

export interface OwnVariable {
	key: string;
	/** Environments and globals. */
	sharedValue?: string | null;
	/** Collections. */
	value?: string;
}

/** The scope's own variables: shared values, then the caller's values. */
export function ownHostSources(
	variables: readonly OwnVariable[],
	localValues: readonly { key: string; value: string }[],
): SuggestionSource[] {
	const local = new Map(localValues.map((entry) => [entry.key, entry.value]));
	return variables.map((variable) => ({
		key: variable.key,
		values: [variable.sharedValue ?? variable.value, local.get(variable.key)],
	}));
}
