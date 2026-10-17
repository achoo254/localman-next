import { z } from "zod";

/** Every call to Tunelo gives up after this long. */
const CALL_TIMEOUT_MS = 5_000;
/** Longest list Localman reads from one source. */
const MAX_TUNNELS = 200;

const tunnelItem = z.object({
	subdomain: z.string().nullable(),
	url: z.string().max(300),
	protocol: z.enum(["http", "tcp"]),
	localPort: z.number().int().min(1).max(65_535).nullable(),
	publicPort: z.number().int().min(1).max(65_535).optional(),
	deviceName: z.string().max(200),
	connectedAt: z.string().max(40),
	basicAuth: z.boolean(),
});
export type TuneloTunnel = z.infer<typeof tunnelItem>;

const tunnelList = z.object({ tunnels: z.array(tunnelItem).max(MAX_TUNNELS) });
const linkInit = z.object({
	requestId: z.string().min(1).max(128),
	code: z.string().min(1).max(32),
	expiresAt: z.iso.datetime({ offset: true }),
});
export type TuneloLinkInit = z.infer<typeof linkInit>;

const linkPoll = z.discriminatedUnion("status", [
	z.object({ status: z.literal("pending") }),
	z.object({ status: z.literal("expired") }),
	z.object({
		status: z.literal("approved"),
		token: z.string().min(1).max(4096),
		linkId: z.string().min(1).max(128),
	}),
]);
export type TuneloLinkPoll = z.infer<typeof linkPoll>;

/**
 * Tunelo did not answer as expected. `status` is the HTTP status (`null`
 * for network errors, timeouts and malformed bodies). Never carries a
 * token: messages name the call only.
 */
export class TuneloApiError extends Error {
	constructor(
		readonly call: string,
		readonly status: number | null,
	) {
		super(`Tunelo ${call} failed${status === null ? "" : ` (${status})`}`);
		this.name = "TuneloApiError";
	}

	/** The token was refused: revoked on the machine, or expired. */
	get unauthorized(): boolean {
		return this.status === 401 || this.status === 403;
	}
}

export type FetchLike = (
	input: string,
	init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

/** Tunelo's account API, as Localman uses it (apps/tunelo-server/src/api). */
export interface TuneloApi {
	/** `GET /api/tunnels` with an account or link token. */
	listTunnels(token: string): Promise<TuneloTunnel[]>;
	/** `POST /api/links/init`: a pairing code for `tunelo link <code>`. */
	initLink(clientName: string): Promise<TuneloLinkInit>;
	/** `POST /api/links/poll`: the link token, once, after approval. */
	pollLink(requestId: string): Promise<TuneloLinkPoll>;
	/** `DELETE /api/links/self`: the link token revokes itself. */
	revokeLink(token: string): Promise<void>;
}

/** Client of the Tunelo at `baseUrl` (`https://tunnel.<domain>`). */
export function createTuneloApi(
	baseUrl: string,
	fetchImpl: FetchLike,
): TuneloApi {
	async function call<T>(
		name: string,
		path: string,
		init: { method: string; token?: string; body?: unknown },
		schema: z.ZodType<T>,
	): Promise<T> {
		const headers: Record<string, string> = { accept: "application/json" };
		if (init.token) headers.authorization = `Bearer ${init.token}`;
		if (init.body !== undefined) headers["content-type"] = "application/json";
		let response: Awaited<ReturnType<FetchLike>>;
		try {
			response = await fetchImpl(new URL(path, baseUrl).href, {
				method: init.method,
				headers,
				body: init.body === undefined ? undefined : JSON.stringify(init.body),
				redirect: "error",
				signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
			});
		} catch {
			throw new TuneloApiError(name, null);
		}
		if (!response.ok) throw new TuneloApiError(name, response.status);
		const parsed = schema.safeParse(await response.json().catch(() => null));
		if (!parsed.success) throw new TuneloApiError(name, null);
		return parsed.data;
	}

	return {
		listTunnels: async (token) =>
			(await call("list", "/api/tunnels", { method: "GET", token }, tunnelList))
				.tunnels,
		initLink: (clientName) =>
			call(
				"link init",
				"/api/links/init",
				{ method: "POST", body: { clientName } },
				linkInit,
			),
		pollLink: (requestId) =>
			call(
				"link poll",
				"/api/links/poll",
				{ method: "POST", body: { requestId } },
				linkPoll,
			),
		revokeLink: async (token) => {
			await call(
				"link revoke",
				"/api/links/self",
				{ method: "DELETE", token },
				z.unknown(),
			);
		},
	};
}
