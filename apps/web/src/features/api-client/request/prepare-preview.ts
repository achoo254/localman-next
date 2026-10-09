/**
 * The request as it would be sent, for previews (auto headers, code
 * snippets) that must not depend on file bytes: picked files stand in as
 * empty bytes, since only their name and type show.
 */
import {
	type ApiRequestDraft,
	type PreparedRequest,
	prepareRequest,
} from "@localman/shared/api-client";
import { withVerbatimQuery } from "./params-sync";

const NO_BYTES = new Uint8Array(0);

/** Empty bytes for every file the draft's body refers to. */
export function placeholderFiles(
	draft: ApiRequestDraft,
): Map<string, Uint8Array> {
	const refs = [
		draft.body.binary,
		...draft.body.formData.map((row) => row.file ?? null),
	];
	const files = new Map<string, Uint8Array>();
	for (const ref of refs) if (ref) files.set(ref.fileId, NO_BYTES);
	return files;
}

/** `null` when the draft cannot be prepared (no valid URL yet, bad header). */
export function previewRequest(draft: ApiRequestDraft): PreparedRequest | null {
	try {
		return prepareRequest(withVerbatimQuery(draft), {
			files: placeholderFiles(draft),
		});
	} catch {
		return null;
	}
}
