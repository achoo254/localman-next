/** MongoDB E11000: a unique index rejected the write. */
export function isDuplicateKeyError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === 11000
	);
}

/** Fields of the unique index an E11000 error hit (empty when unknown). */
export function duplicateKeyFields(error: unknown): string[] {
	if (!isDuplicateKeyError(error) || typeof error !== "object" || !error) {
		return [];
	}
	const pattern = "keyPattern" in error ? error.keyPattern : undefined;
	return typeof pattern === "object" && pattern !== null
		? Object.keys(pattern)
		: [];
}
