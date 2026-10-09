/**
 * Headers added on send that the Headers table does not list: Host from
 * the URL, auth from the Authorization tab, Content-Type from the body,
 * and the proxy's own headers. Values are shown as typed (`{{var}}` kept).
 */
import {
	type ApiRequestDraft,
	type HeaderEntry,
	authParts,
	buildPreparedBody,
	normalizeRequestUrl,
	parseHttpUrl,
	resolveEffectiveAuth,
} from "@localman/shared/api-client";
import { placeholderFiles } from "./prepare-preview";

export type AutoHeaderSource = "url" | "auth" | "body" | "proxy" | "clientIp";

export interface AutoHeader extends HeaderEntry {
	source: AutoHeaderSource;
}

const BOUNDARY_SHOWN = "…";

function sameName(a: string, b: string): boolean {
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Content-Type the body implies; `null` for no body or a failed build. */
function bodyContentType(draft: ApiRequestDraft): string | null {
	try {
		return buildPreparedBody(draft.method, draft.body, {
			fill: (text) => text,
			files: placeholderFiles(draft),
			boundary: BOUNDARY_SHOWN,
		}).contentType;
	} catch {
		return null;
	}
}

export function autoHeaders(draft: ApiRequestDraft): AutoHeader[] {
	const list: AutoHeader[] = [];
	const url = parseHttpUrl(normalizeRequestUrl(draft.url));
	// An unfilled `{{baseUrl}}` parses as a host; the real one is unknown yet.
	if (url && !/[{}]/.test(url.hostname)) {
		list.push({ name: "Host", value: url.host, source: "url" });
	}

	const auth = authParts(resolveEffectiveAuth(draft.auth));
	for (const header of auth.headers) list.push({ ...header, source: "auth" });

	const typed = draft.headers.filter((row) => row.enabled && row.key.trim());
	const contentType = bodyContentType(draft);
	if (contentType && !typed.some((row) => sameName(row.key, "content-type"))) {
		list.push({ name: "Content-Type", value: contentType, source: "body" });
	}

	list.push({ name: "X-Localman-Proxy", value: "1", source: "proxy" });
	if (draft.settings.sendClientIp) {
		// `proto` is how the browser reached Localman, not the target's scheme.
		const protocol = window.location.protocol.replace(":", "");
		for (const [name, value] of [
			["X-Forwarded-For", "<client-ip>"],
			["X-Real-IP", "<client-ip>"],
			["Forwarded", `for=<client-ip>;proto=${protocol}`],
		] as const) {
			list.push({ name, value, source: "clientIp" });
		}
	}
	return list;
}
