const MAX_DISPLAY_NAME_LENGTH = 80;

/** A name shown to users (device, link client): C0/C1 control characters
 *  stripped (no terminal escape injection), trimmed, length capped. */
export function cleanDisplayName(name: string | undefined): string | undefined {
	if (name === undefined) return undefined;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
	const cleaned = name.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
	return cleaned.slice(0, MAX_DISPLAY_NAME_LENGTH) || undefined;
}
