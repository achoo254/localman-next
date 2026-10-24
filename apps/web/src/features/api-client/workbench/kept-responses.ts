/**
 * The last response of each collection request sent in this browser tab,
 * for `{{response …}}` references. In memory only: a reload starts empty
 * and references send their source again.
 */
import type {
	ClientResponse,
	KeptResponse,
	TabSource,
} from "@localman/shared/api-client";

const kept = new Map<string, KeptResponse>();

const keyOf = (source: TabSource): string =>
	`${source.collectionId}:${source.nodeId}`;

export function keepResponse(
	source: TabSource,
	response: ClientResponse,
): void {
	kept.set(keyOf(source), { response, at: Date.now() });
}

export function keptResponse(source: TabSource): KeptResponse | undefined {
	return kept.get(keyOf(source));
}

/** TEST ONLY. */
export function forgetKeptResponses(): void {
	kept.clear();
}
