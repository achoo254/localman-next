/**
 * Clipboard access behind one function, so a desktop/mobile shell can swap
 * the implementation. Resolves `false` instead of throwing when the browser
 * refuses (no permission, insecure context, no user activation): callers
 * then let the user copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
	const clipboard = globalThis.navigator?.clipboard;
	if (!clipboard) return false;
	try {
		await clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
