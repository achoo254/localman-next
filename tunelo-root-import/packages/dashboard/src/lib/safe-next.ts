// Reads a post-auth redirect target ("next") from a query string.
// Only same-origin absolute paths are allowed — rejects protocol-relative
// ("//evil") and external URLs so a crafted link can't redirect elsewhere.
export function getSafeNext(search: string): string | null {
	const next = new URLSearchParams(search).get("next");
	if (!next) return null;
	if (!next.startsWith("/") || next.startsWith("//")) return null;
	return next;
}
