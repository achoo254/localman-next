import {
	type ApiRequestDraft,
	apiRequestDraftSchema,
} from "@localman/shared/api-client";
import { fetchLogDraft } from "../../request-log/request-log-api";

/**
 * The draft of a request log line, checked against the draft schema: the
 * API answer is parsed like any untrusted input. `null` when it is not a
 * valid request draft.
 */
export async function loadLogDraft(
	projectId: string,
	logId: string,
): Promise<ApiRequestDraft | null> {
	const parsed = apiRequestDraftSchema.safeParse(
		await fetchLogDraft(projectId, logId),
	);
	return parsed.success ? parsed.data : null;
}
