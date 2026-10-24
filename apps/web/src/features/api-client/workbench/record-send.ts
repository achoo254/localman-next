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
 * Where a redirect ended, as origin and path. Kept only when the URL sent
 * is the URL as written: once a `{{var}}` was filled in (or a script
 * changed it), the redirect may repeat that value in its host or path, and
 * a secret would reach the server. Without a redirect the final URL is the
 * sent one, so nothing is kept; the query never is, tokens travel there.
 */
export function redirectedTo(
	writtenUrl: string,
	sentUrl: string,
	finalUrl: string,
): string | undefined {
	if (sentUrl !== writtenUrl.trim()) return undefined;
	if (!URL.canParse(sentUrl) || !URL.canParse(finalUrl)) return undefined;
	const sent = new URL(sentUrl);
	const final = new URL(finalUrl);
	const where = `${final.origin}${final.pathname}`;
	return where === `${sent.origin}${sent.pathname}` ? undefined : where;
}

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
	const { response, route, request } = settled.result;
	try {
		await recordHistoryEntry(redactDraft(draft), {
			status: response.status,
			ms: Math.round(response.timings.total),
			size: response.size,
			route,
			finalUrl: redirectedTo(draft.url, request.url, response.finalUrl),
		});
		await invalidateHistory(queryClient);
		return true;
	} catch {
		return false;
	}
}
