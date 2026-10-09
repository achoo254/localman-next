import { normalizeInternalPath } from "../../http/internal-path.js";

export const DEFAULT_RETURN_TO = "/projects";

/**
 * Where to send the browser after sign-in: the normalized internal path,
 * or the default for anything else (absolute URLs, `//host`, `/\host`, dot
 * segments that collapse to `//host`), so `returnTo` cannot become an open
 * redirect.
 */
export function safeReturnTo(value: unknown): string {
	return normalizeInternalPath(value) ?? DEFAULT_RETURN_TO;
}
