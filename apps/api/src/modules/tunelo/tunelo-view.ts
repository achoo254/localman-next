import { z } from "zod";
import { USER_SCOPE } from "../../http/require-auth.js";

/** One live tunnel of the user, from their account or a linked machine. */
export const localTunnelView = z.object({
	/**
	 * `account` (signed in with `tunelo login`), `link` (an anonymous
	 * machine linked with a code before that flow was retired), or
	 * `machine`: no tunnel, but `localhost:<port>` on one of the user's own
	 * machines, reached through its machine tunnel (`url` is that tunnel;
	 * send with `machine: linkId`).
	 */
	source: z.enum(["account", "link", "machine"]),
	/** Id of the linked machine (`link` and `machine`). */
	linkId: z.string().nullable(),
	protocol: z.enum(["http", "tcp"]),
	/** Tunnel origin (`https://<name>.<domain>`), or `tcp://host:port`. */
	url: z.string(),
	localPort: z.number().int().nullable(),
	publicPort: z.number().int().nullable(),
	deviceName: z.string(),
	connectedAt: z.string(),
	/** Visitors must pass Basic Auth: it uses the request's `Authorization`. */
	basicAuth: z.boolean(),
});
export type LocalTunnel = z.infer<typeof localTunnelView>;

/** A source whose list could not be read; the others are still listed. */
export const tunnelSourceFailureView = z.object({
	source: z.enum(["account", "link"]),
	linkId: z.string().nullable(),
	/**
	 * `unauthorized`: Tunelo refused the token (link revoked on the machine,
	 * or no Tunelo account); `unavailable`: Tunelo did not answer.
	 */
	reason: z.enum(["unauthorized", "unavailable"]),
});
export type TunnelSourceFailure = z.infer<typeof tunnelSourceFailureView>;

export const localTunnelListView = z.object({
	tunnels: z.array(localTunnelView),
	failures: z.array(tunnelSourceFailureView),
});
export type LocalTunnelList = z.infer<typeof localTunnelListView>;

/** A linked machine, as the settings list it. */
export const tunnelLinkView = z.object({
	id: z.string(),
	/**
	 * `self` (the `tunelo` process of the user's account linked itself
	 * after `tunelo login`, and can reach its localhost) or `pairing` (an
	 * anonymous machine linked with a code before that flow was retired:
	 * listed and removable, never created any more).
	 */
	source: z.enum(["pairing", "self"]),
	/** Learnt from the machine's tunnels; `null` until one was seen. */
	deviceName: z.string().nullable(),
	/** The machine's id in Chat (`self` only). */
	machineId: z.string().nullable(),
	/** Localman may send requests to the machine's localhost (`self` only). */
	forwardEnabled: z.boolean(),
	linkedAt: z.string(),
	/** Tunelo refused its token (revoked on the machine): only removable. */
	revoked: z.boolean(),
});
export type TunnelLinkView = z.infer<typeof tunnelLinkView>;

export const tunnelLinksView = z.object({ links: z.array(tunnelLinkView) });

export const TUNELO_ABOUT =
	"Tunelo tunnels of the signed-in user, own only: the tunnels of their Tunelo account (same sign-in, `tunelo login`), whose machines link themselves, plus anonymous machines linked with a code before that flow was retired. Tokens never leave the server.";

/**
 * Exempt reason of the operations on linked machines: a link decides which
 * tunnels the browser sends request credentials to on its own, so only
 * the user lists or revokes them, from the UI.
 */
export const LINK_EXEMPT =
	"lists or revokes the machines whose tunnels receive request credentials; only the user does it, from the UI";

export const TUNELO_MACHINE_ABOUT =
	"The user's own machines: each one's `tunelo` process linked itself after `tunelo login` on the same account, and Localman sends requests for `localhost:<port>` there through the machine's tunnel. Only the account's owner reaches them. Link tokens never leave the server.";

/** Exempt reason of the tunnel list. */
export const LIST_EXEMPT =
	"read by the browser's router with the session's IdP token; an agent needs no list: send_request routes a localhost target through the user's tunnel itself";

export const tuneloOperationBase = {
	scopes: [USER_SCOPE],
	toolset: "client",
} as const;
