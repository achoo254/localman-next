/**
 * Saves text or bytes as a file. On the web this is a temporary object URL
 * clicked through a hidden link; a desktop shell can swap in a native save
 * dialog.
 */
function downloadBlob(filename: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.hidden = true;
	document.body.append(link);
	link.click();
	link.remove();
	// Revoke on the next tick: some browsers start the download asynchronously.
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(
	filename: string,
	text: string,
	type = "text/csv;charset=utf-8",
): void {
	downloadBlob(filename, new Blob([text], { type }));
}

/** Bytes (a binary response body) under `type`, octet-stream when empty. */
export function downloadBytes(
	filename: string,
	bytes: Uint8Array,
	type: string,
): void {
	// A copy backed by a plain ArrayBuffer, which every Blob accepts.
	const blob = new Blob([bytes.slice()], {
		type: type || "application/octet-stream",
	});
	downloadBlob(filename, blob);
}
