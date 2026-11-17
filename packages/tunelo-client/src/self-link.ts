/**
 * Links this machine to an app of its account (Localman): the Tunelo
 * server mints a link token that lists the machine's tunnels and may send
 * requests to its loopback through the machine tunnel. The caller hands
 * the token to the app and keeps no copy.
 */
const HTTP_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 512;

export interface SelfLink {
	/** Link token, shown once. */
	token: string;
	/** Tunelo's id of the link (`tunelo` lists and revokes it). */
	linkId: string;
	/** `https://m-<hash>.<domain>/.tunelo/forward` of this machine. */
	forwardUrl: string;
}

export interface SelfLinkOptions {
	/** Tunelo server, e.g. `https://tunnel.hoandat.com`. */
	serverUrl: string;
	/** The account's access token for the server's resource (`tunnels:open`). */
	accessToken: string;
	/** The machine tunnel's `deviceId`. */
	deviceId: string;
	/** Name of the app shown in the machine's link list. */
	clientName: string;
	/** Defaults to the global `fetch`; tests pass their own. */
	fetch?: typeof fetch;
}

/** The server refused or answered something else. Never carries a token. */
export class SelfLinkError extends Error {
	constructor(
		public readonly status: number | null,
		public readonly code: string | null,
	) {
		super(
			`Tunelo did not link this machine (${code ?? status ?? "no answer"})`,
		);
		this.name = "SelfLinkError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function errorCodeOf(body: unknown): string | null {
	if (!isRecord(body) || !isRecord(body.error)) return null;
	return typeof body.error.code === "string" ? body.error.code : null;
}

function parseSelfLink(body: unknown): SelfLink | null {
	if (!isRecord(body)) return null;
	const { token, linkId, forwardUrl } = body;
	if (
		typeof token !== "string" ||
		token.length === 0 ||
		token.length > MAX_TOKEN_LENGTH ||
		typeof linkId !== "string" ||
		typeof forwardUrl !== "string" ||
		!URL.canParse(forwardUrl) ||
		new URL(forwardUrl).protocol !== "https:"
	) {
		return null;
	}
	return { token, linkId, forwardUrl };
}

/** `POST /api/links/self` on the Tunelo server. */
export async function linkMachineToApp(
	options: SelfLinkOptions,
): Promise<SelfLink> {
	const fetchImpl = options.fetch ?? fetch;
	let res: Response;
	try {
		res = await fetchImpl(new URL("/api/links/self", options.serverUrl), {
			method: "POST",
			headers: {
				authorization: `Bearer ${options.accessToken}`,
				"content-type": "application/json",
				accept: "application/json",
			},
			body: JSON.stringify({
				deviceId: options.deviceId,
				clientName: options.clientName,
			}),
			redirect: "error",
			signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
		});
	} catch {
		throw new SelfLinkError(null, null);
	}
	const body: unknown = await res.json().catch(() => null);
	if (!res.ok) throw new SelfLinkError(res.status, errorCodeOf(body));
	const link = parseSelfLink(body);
	if (!link) throw new SelfLinkError(res.status, null);
	return link;
}
