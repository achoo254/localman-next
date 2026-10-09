/**
 * Saves text as a file. On the web this is a temporary object URL clicked
 * through a hidden link; a desktop shell can swap in a native save dialog.
 */
export function downloadText(
	filename: string,
	text: string,
	type = "text/csv;charset=utf-8",
): void {
	const url = URL.createObjectURL(new Blob([text], { type }));
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
