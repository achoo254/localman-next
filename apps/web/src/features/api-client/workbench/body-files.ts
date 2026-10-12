import type { ApiRequestDraft } from "@localman/shared/api-client";
import { readFileBytes } from "../../../platform/file-read";

/** Bytes of the files the active body refers to. */
export async function bodyFiles(
	draft: ApiRequestDraft,
	files: ReadonlyMap<string, File>,
): Promise<Map<string, Uint8Array>> {
	const refs =
		draft.body.type === "binary"
			? [draft.body.binary]
			: draft.body.type === "formdata"
				? draft.body.formData.map((row) => (row.enabled ? row.file : null))
				: [];
	const bytes = new Map<string, Uint8Array>();
	for (const ref of refs) {
		const file = ref ? files.get(ref.fileId) : undefined;
		if (ref && file) bytes.set(ref.fileId, await readFileBytes(file));
	}
	return bytes;
}
