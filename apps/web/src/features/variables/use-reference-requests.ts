/**
 * The requests a `{{response …}}` of the open tab may read: those of its
 * collection, from the same cached query as its variable scopes. `null`
 * outside a saved request (references only work there) and while
 * environments are off.
 */
import type { KeptResponse, TabSource } from "@localman/shared/api-client";
import { useCallback, useMemo } from "react";
import { keptResponse } from "../api-client/workbench/kept-responses";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { useCollection } from "../collections/use-collections";
import { requestsInOrder } from "../collections/use-request-named";
import { useEnvironmentsEnabled } from "../environments/use-environments-enabled";
import {
	type ReferenceRequest,
	type ReferenceSuggestion,
	referenceSuggestions,
} from "./response-suggestions";

export interface ReferenceRequests {
	/** Request names a reference may name (trimmed). */
	readonly names: ReadonlySet<string>;
	/** The suggestions now, kept responses read at call time. */
	readonly suggest: () => ReferenceSuggestion[];
	/** The last response kept of the request named so, if any. */
	readonly keptFor: (requestName: string) => KeptResponse | undefined;
}

export function useReferenceRequests(
	tab: Pick<WorkbenchTab, "source">,
): ReferenceRequests | null {
	const enabled = useEnvironmentsEnabled();
	const source: TabSource | null = enabled ? tab.source : null;
	const collection = useCollection(
		source?.collectionId ?? "",
		source !== null,
	).data;
	const requests = useMemo<ReferenceRequest[] | null>(() => {
		if (!source || !collection) return null;
		return requestsInOrder(collection).map((node) => ({
			name: node.name.trim(),
			source: { collectionId: source.collectionId, nodeId: node.id },
		}));
	}, [source, collection]);
	const suggest = useCallback(
		() =>
			requests ? referenceSuggestions(requests, source, keptResponse) : [],
		[requests, source],
	);
	return useMemo(() => {
		if (!requests) return null;
		const keptFor = (requestName: string) => {
			const found = requests.find(({ name }) => name === requestName.trim());
			return found ? keptResponse(found.source) : undefined;
		};
		return {
			names: new Set(requests.map(({ name }) => name)),
			suggest,
			keptFor,
		};
	}, [requests, suggest]);
}
