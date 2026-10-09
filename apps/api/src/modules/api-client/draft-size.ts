import { OperationError } from "@localman/operations";
import type { ApiRequestDraft } from "@localman/shared/api-client";

const KIB = 1024;

/**
 * Largest saved tab (`client_drafts`), as JSON. Far below the 10 MB a
 * request body may reach when sent: every saved tab is loaded again on
 * each visit of the API client, so a huge body stays in the open tab only.
 */
export const DRAFT_MAX_BYTES = 1024 * KIB;

/**
 * JSON body accepted by the routes that carry a draft: the draft plus room
 * for the fields around it. Larger bodies get 413 `PAYLOAD_TOO_LARGE`.
 */
export const DRAFT_BODY_LIMIT = DRAFT_MAX_BYTES + 64 * KIB;

/** Size of the draft as stored, in UTF-8 bytes of its JSON. */
export function draftBytes(draft: ApiRequestDraft): number {
	return Buffer.byteLength(JSON.stringify(draft), "utf8");
}

/** 413 `DRAFT_TOO_LARGE` with the cap and the size that was sent. */
export function draftTooLarge(bytes: number, maxBytes: number): OperationError {
	return new OperationError(
		413,
		"DRAFT_TOO_LARGE",
		`A saved request may hold at most ${maxBytes} bytes of JSON`,
		{ maxBytes, bytes },
	);
}
