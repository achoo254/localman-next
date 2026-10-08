/** Static segments or `:name` params only; no wildcards or optional groups. */
const PATH_PATTERN = /^(?:\/(?:[A-Za-z0-9._~-]+|:[A-Za-z_][A-Za-z0-9_]*))+$/;
const PARAM_PATTERN = /:([A-Za-z_][A-Za-z0-9_]*)/g;

export function isValidOperationPath(path: string): boolean {
	return PATH_PATTERN.test(path);
}

export function pathParamNames(path: string): string[] {
	return Array.from(path.matchAll(PARAM_PATTERN), (match) => match[1] ?? "");
}

/** Converts an Express path (`/items/:id`) to OpenAPI form (`/items/{id}`). */
export function toOpenApiPath(path: string): string {
	return path.replace(PARAM_PATTERN, "{$1}");
}
