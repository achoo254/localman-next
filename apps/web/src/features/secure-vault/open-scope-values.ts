import type { LocalValue } from "@localman/shared/api-client";
import {
	collectionScope,
	environmentScope,
	globalsScope,
	openLocalValues,
} from "./vault-codec";

/** `openLocalValues` of an environment, a collection or a workspace's globals. */
export function openScopeValues(
	kind: "environment" | "collection" | "global",
	id: string,
	values: readonly LocalValue[],
): LocalValue[] {
	const scope =
		kind === "environment"
			? environmentScope(id)
			: kind === "collection"
				? collectionScope(id)
				: globalsScope(id);
	return openLocalValues(scope, values);
}
