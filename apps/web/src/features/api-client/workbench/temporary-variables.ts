/**
 * Temporary variables of a tab: set from "Set as variable" or "Add to",
 * kept in memory only (lost when the tab closes) and resolved above every
 * scope, as the resolver's `temporary` layer.
 */
import {
	type ResolverLayer,
	type ScopeVariable,
	entryVariables,
} from "@localman/shared/api-client";
import type { SendContext } from "./workbench-tab-types";

export interface TemporaryVariable {
	key: string;
	value: string;
}

export const NO_TEMPORARY: readonly TemporaryVariable[] = Object.freeze([]);

/**
 * `list` with `key` set to `value` (in place when it exists, else
 * appended), or removed when `value` is `null`. The same array comes back
 * when nothing changes.
 */
export function withTemporary(
	list: readonly TemporaryVariable[],
	key: string,
	value: string | null,
): readonly TemporaryVariable[] {
	const name = key.trim();
	if (!name) return list;
	const index = list.findIndex((item) => item.key === name);
	if (value === null) {
		return index === -1 ? list : list.filter((item) => item.key !== name);
	}
	if (index === -1) return [...list, { key: name, value }];
	if (list[index]?.value === value) return list;
	return list.map((item) => (item.key === name ? { key: name, value } : item));
}

/** The tab's temporary variables as the top layer of the resolver. */
export function temporaryLayer(
	list: readonly TemporaryVariable[],
): ResolverLayer {
	return {
		kind: "temporary",
		variables: list.map(
			(item): ScopeVariable => ({
				key: item.key,
				value: item.value,
				enabled: true,
				secret: false,
				source: "local",
				withheld: false,
			}),
		),
	};
}

/**
 * The layers a send resolves with the tab's temporary variables on top.
 * Without layers (environments off, or a request using no variable) the
 * bound tab's collection variables stand below them, as they would alone.
 */
export function withTemporaryLayer(
	layers: readonly ResolverLayer[] | undefined,
	context: SendContext | null,
	list: readonly TemporaryVariable[],
): readonly ResolverLayer[] | undefined {
	if (list.length === 0) return layers;
	const base: readonly ResolverLayer[] =
		layers ??
		(context
			? [{ kind: "collection", variables: entryVariables(context.variables) }]
			: []);
	return [...base, temporaryLayer(list)];
}
