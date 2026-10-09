/** MongoDB E11000: a unique index rejected the write. */
export function isDuplicateKeyError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === 11000
	);
}
