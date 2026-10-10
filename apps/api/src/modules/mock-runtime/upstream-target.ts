import { isTunnelUrl } from "@localman/shared/api-client";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { ClientSettingsModel } from "../api-client/client-settings-model.js";
import type { ProjectUpstream } from "./upstream-config.js";

/** Finds the tunnel origin `owner` mapped to `localhost:<port>`, if any. */
export type TunnelLookup = (
	owner: string,
	port: number,
) => Promise<string | null>;

interface StoredMappings {
	tunnelMappings?: { key: string; url: string; enabled?: boolean }[];
}

/**
 * The owner's own manual mapping of `localhost:<port>` (API client
 * settings), when enabled and still on one of `TUNNEL_DOMAINS`: a domain
 * removed from the setting stops being forwarded to at once.
 */
export const ownerTunnelUrl: TunnelLookup = async (owner, port) => {
	const key = `localhost:${port}`;
	const settings = await ClientSettingsModel.findOne({ userSub: owner })
		.select("tunnelMappings")
		.lean<StoredMappings>();
	const mapping = settings?.tunnelMappings?.find(
		(candidate) => candidate.key === key && candidate.enabled !== false,
	);
	if (!mapping) return null;
	return isTunnelUrl(mapping.url, runtimeSettings().tunnelDomains)
		? mapping.url
		: null;
};

/**
 * Whether `rawPath` stays below where it starts, read the way a lenient
 * upstream would: percent-decoded (`%2e%2e`, `..%2f`), `\` as `/` (`%5c`),
 * then `.`/`..` resolved. Empty segments count as nothing, so a doubtful
 * path is refused rather than let through. Bad escapes are refused.
 */
export function staysBelowStart(rawPath: string): boolean {
	let decoded: string;
	try {
		decoded = decodeURIComponent(rawPath);
	} catch {
		return false;
	}
	let depth = 0;
	for (const segment of decoded.split(/[/\\]/)) {
		if (segment === "..") depth -= 1;
		else if (segment !== "" && segment !== ".") depth += 1;
		if (depth < 0) return false;
	}
	return true;
}

/** Whether the built URL's path is still the base's path or below it. */
export function isBelowBase(url: string, base: string): boolean {
	const prefix = new URL(base).pathname.replace(/\/+$/, "");
	const path = new URL(url).pathname;
	return prefix === "" || path === prefix || path.startsWith(`${prefix}/`);
}

/** `base` (no trailing slash) followed by the path and query. */
function join(base: string, rawPath: string, query: string): string {
	const trimmed = base.replace(/\/+$/, "");
	return `${trimmed}${rawPath}${query ? `?${query}` : ""}`;
}

/**
 * Where an unmatched request goes: the upstream's base (tunnel origin or
 * base URL, whose own path is kept as a prefix) followed by the path the
 * client used below the secret, prefix included, and its query. `null`
 * when a tunnel upstream has no usable mapping.
 */
export async function upstreamUrlOf(
	upstream: Exclude<ProjectUpstream, { kind: "none" }>,
	owner: string,
	rawPath: string,
	query: string,
	findTunnel: TunnelLookup,
): Promise<string | null> {
	if (upstream.kind === "url") return join(upstream.baseUrl, rawPath, query);
	const origin = await findTunnel(owner, upstream.port);
	return origin === null ? null : join(origin, rawPath, query);
}
