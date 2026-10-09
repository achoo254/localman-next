/**
 * Draft writes that fail for a passing reason (network, rate limit, server
 * error) are tried again a few times before the status bar reports them.
 * A refusal (cap of tabs, draft too large, bad draft) is final at once.
 */
import { ApiError } from "../../../lib/api-client";

/** Wait before each new try of a failed draft write. */
export const DRAFT_RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000, 9_000];

/** Worth trying again: the network, a rate limit or the server failed. */
export function isTransientError(error: unknown): boolean {
	if (!(error instanceof ApiError)) return true;
	return error.status === 0 || error.status === 429 || error.status >= 500;
}

/** Runs `write`, again after each delay while it fails for a passing reason. */
export async function withRetries(
	write: () => Promise<void>,
	delaysMs: readonly number[],
): Promise<void> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			await write();
			return;
		} catch (error) {
			const delay = delaysMs[attempt];
			if (delay === undefined || !isTransientError(error)) throw error;
			await new Promise((resolve) => window.setTimeout(resolve, delay));
		}
	}
}
