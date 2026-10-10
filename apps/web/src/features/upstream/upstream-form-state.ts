/**
 * The upstream form as typed (strings) and its check before saving. The
 * server checks the URL again, plus its private-network guard.
 */
import type { ProjectUpstream } from "./traffic-settings-api";

export type UpstreamKind = ProjectUpstream["kind"];

export const UPSTREAM_KINDS: readonly UpstreamKind[] = [
	"none",
	"tunnel",
	"url",
];

export interface UpstreamDraft {
	kind: UpstreamKind;
	port: string;
	baseUrl: string;
}

export const MIN_PORT = 1;
export const MAX_PORT = 65_535;

export function draftOf(upstream: ProjectUpstream): UpstreamDraft {
	return {
		kind: upstream.kind,
		port: upstream.kind === "tunnel" ? String(upstream.port) : "",
		baseUrl: upstream.kind === "url" ? upstream.baseUrl : "",
	};
}

/** The port as a number, or `null` when it is not a whole 1–65535. */
export function parsePort(value: string): number | null {
	const text = value.trim();
	if (!/^\d{1,5}$/.test(text)) return null;
	const port = Number(text);
	return port >= MIN_PORT && port <= MAX_PORT ? port : null;
}

/** An https base URL without credentials, query or fragment. */
export function isPublicHttpsUrl(value: string): boolean {
	const text = value.trim();
	if (!URL.canParse(text) || /[?#]/.test(text)) return false;
	const url = new URL(text);
	return (
		url.protocol === "https:" &&
		url.hostname !== "" &&
		url.username === "" &&
		url.password === ""
	);
}

export type UpstreamCheck =
	| { ok: true; upstream: ProjectUpstream }
	| { ok: false; field: "port" | "baseUrl" };

export function checkUpstream(draft: UpstreamDraft): UpstreamCheck {
	if (draft.kind === "none") return { ok: true, upstream: { kind: "none" } };
	if (draft.kind === "tunnel") {
		const port = parsePort(draft.port);
		return port === null
			? { ok: false, field: "port" }
			: { ok: true, upstream: { kind: "tunnel", port } };
	}
	return isPublicHttpsUrl(draft.baseUrl)
		? { ok: true, upstream: { kind: "url", baseUrl: draft.baseUrl.trim() } }
		: { ok: false, field: "baseUrl" };
}
