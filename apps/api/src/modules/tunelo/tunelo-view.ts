import { z } from "zod";
import { USER_SCOPE } from "../../http/require-auth.js";

/** One live tunnel of the user, from their account or a linked machine. */
export const localTunnelView = z.object({
	/** `account` (signed in with `tunelo login`) or `link` (`tunelo link`). */
	source: z.enum(["account", "link"]),
	/** Id of the linked machine (`link` only). */
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
	/** Learnt from the machine's tunnels; `null` until one was seen. */
	deviceName: z.string().nullable(),
	linkedAt: z.string(),
	/** Tunelo refused its token (revoked on the machine): only removable. */
	revoked: z.boolean(),
});
export type TunnelLinkView = z.infer<typeof tunnelLinkView>;

export const tunnelLinksView = z.object({ links: z.array(tunnelLinkView) });

/** A pairing waiting for `tunelo link <code>` on the machine. */
export const pendingLinkView = z.object({
	id: z.string(),
	code: z.string(),
	expiresAt: z.string(),
});

export const linkPollView = z.discriminatedUnion("status", [
	z.object({ status: z.literal("pending") }),
	z.object({ status: z.literal("expired") }),
	z.object({ status: z.literal("linked"), link: tunnelLinkView }),
]);

export const TUNELO_ABOUT =
	"Tunelo tunnels of the signed-in user, own only: the tunnels of their Tunelo account (same sign-in, `tunelo login`) and of anonymous machines they linked with `tunelo link <code>`. Tokens never leave the server.";

/**
 * Exempt reason of the operations that link machines: a link decides which
 * tunnels the browser sends request credentials to on its own, so only
 * the user links or revokes a machine, from the UI.
 */
export const LINK_EXEMPT =
	"links or revokes the machines whose tunnels receive request credentials; only the user does it, from the UI";

/** Exempt reason of the tunnel list. */
export const LIST_EXEMPT =
	"read by the browser's router to send a local address through the user's tunnel; the send_request tool runs on the server and cannot reach the user's machine";

export const tuneloOperationBase = {
	scopes: [USER_SCOPE],
	toolset: "client",
} as const;
