/**
 * After a send: the request goes to the account's history as the tab has
 * it (`{{var}}` kept, so no variable's value reaches the server), with
 * credentials typed in literally blanked (`redactDraft`), and
 * what the browser measured of the response.
 */
import { type ApiRequestDraft, redactDraft } from "@localman/shared/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { recordHistoryEntry } from "../history/history-api";
import { invalidateHistory } from "../history/use-history";
import type { SettledResponse } from "./workbench-types";

/**
 * Resolves `false` when history could not be written; the send itself
 * already succeeded, so the caller only reports it.
 */
export async function recordSend(
	draft: ApiRequestDraft,
	settled: SettledResponse,
	queryClient: QueryClient,
): Promise<boolean> {
	if (settled.kind !== "done") return true;
	const { response, route } = settled.result;
	try {
		await recordHistoryEntry(redactDraft(draft), {
			status: response.status,
			ms: Math.round(response.timings.total),
			size: response.size,
			route,
			finalUrl: response.finalUrl,
		});
		await invalidateHistory(queryClient);
		return true;
	} catch {
		return false;
	}
}
