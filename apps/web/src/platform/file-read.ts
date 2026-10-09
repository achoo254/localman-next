/**
 * Files picked for a request body (binary, form-data). The bytes stay in
 * the browser tab; drafts and history keep only the `FileRef`.
 */
import {
	type FileRef,
	MAX_REQUEST_BODY_BYTES,
} from "@localman/shared/api-client";

/** The picked file as a body part reference; `fileId` keys its bytes. */
export function fileRefOf(file: File, fileId: string): FileRef {
	return {
		fileId,
		name: file.name,
		contentType: file.type,
		size: file.size,
	};
}

/** A file over the request body cap can never be sent. */
export function isFileTooLarge(file: File): boolean {
	return file.size > MAX_REQUEST_BODY_BYTES;
}

/** Bytes of a picked file; rejects when the browser cannot read it. */
export async function readFileBytes(file: File): Promise<Uint8Array> {
	if (typeof file.arrayBuffer === "function") {
		return new Uint8Array(await file.arrayBuffer());
	}
	// Engines without Blob#arrayBuffer (older WebViews, jsdom) still have FileReader.
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
			else reject(new Error("File could not be read as bytes"));
		};
		reader.onerror = () =>
			reject(reader.error ?? new Error("File could not be read"));
		reader.readAsArrayBuffer(file);
	});
}
