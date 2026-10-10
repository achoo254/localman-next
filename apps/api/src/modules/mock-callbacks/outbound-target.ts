import { z } from "zod";
import {
	type TunnelLookup,
	upstreamUrlOf,
} from "../mock-runtime/upstream-target.js";

/**
 * Where the server delivers an inbox forward or a mock callback: an https
 * URL, or the owner's Tunelo tunnel of `localhost:<port>` plus a path.
 */
export type OutboundTarget =
	| { readonly kind: "url"; readonly url: string }
	| { readonly kind: "tunnel"; readonly port: number; readonly path: string };

export const MAX_TARGET_PATH = 512;
export const MAX_TARGET_URL = 2048;

export const portSchema = z.number().int().min(1).max(65_535);
/** Starts with `/`; no spaces, query or fragment. */
export const tunnelPathSchema = z
	.string()
	.max(MAX_TARGET_PATH)
	.regex(/^\/[^\s?#]*$/, "must start with / and have no spaces, ? or #");

export const outboundTargetSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("url"),
		url: z.string().min(1).max(MAX_TARGET_URL),
	}),
	z.object({
		kind: z.literal("tunnel"),
		port: portSchema,
		path: tunnelPathSchema,
	}),
]);

/** `https://…` as is, `tunnel:3000/hooks/users` for a tunnel. */
export function targetLabel(target: OutboundTarget): string {
	return target.kind === "url"
		? target.url
		: `tunnel:${target.port}${target.path}`;
}

/**
 * The URL to send to: the URL itself, or the owner's enabled tunnel
 * origin of the port followed by the path and `query`; `null` when that
 * port has no usable mapping.
 */
export function targetUrlOf(
	target: OutboundTarget,
	owner: string,
	query: string,
	findTunnel: TunnelLookup,
): Promise<string | null> {
	if (target.kind === "url") return Promise.resolve(target.url);
	return upstreamUrlOf(
		{ kind: "tunnel", port: target.port },
		owner,
		target.path,
		query,
		findTunnel,
	);
}

/** The stored target as the sender uses it; anything malformed is `null`. */
export function targetOf(stored: unknown): OutboundTarget | null {
	const parsed = outboundTargetSchema.safeParse(stored);
	return parsed.success ? parsed.data : null;
}
