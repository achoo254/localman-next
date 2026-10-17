import { randomBytes } from "node:crypto";
import {
	type IncomingMessage,
	type Server,
	type ServerResponse,
	createServer,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { TuneloTunnel } from "../tunelo-api.js";

const LINK_TTL_MS = 10 * 60 * 1000;

interface Pairing {
	code: string;
	expiresAt: number;
	deviceId: string | null;
}

export interface FakeTunelo {
	readonly url: string;
	/** Tunnels Tunelo lists for an account token of `sub`. */
	setAccountTunnels(sub: string, tunnels: TuneloTunnel[]): void;
	/** Tunnels of an anonymous machine, listed for its link tokens. */
	setDeviceTunnels(deviceId: string, tunnels: TuneloTunnel[]): void;
	/** `tunelo link <code>` on the machine; `false` for an unknown code. */
	approve(code: string, deviceId: string): boolean;
	/** Ends every open pairing as if its 10 minutes ran out. */
	expirePairings(): void;
	/** The machine revokes its links: their tokens get 401. */
	revokeDevice(deviceId: string): void;
	/** While down, every API call answers 503. */
	setDown(down: boolean): void;
	/** Link tokens revoked through `DELETE /api/links/self`. */
	readonly revokedTokens: readonly string[];
	/** `Authorization` header of every call, in order. */
	readonly authorizations: readonly string[];
	/** Extra routes (E2E control); return `true` when handled. */
	extend(route: FakeRoute): void;
	close(): Promise<void>;
}

export type FakeRoute = (
	req: IncomingMessage,
	res: ServerResponse,
	body: unknown,
) => boolean;

function send(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(Buffer.from(chunk));
	const text = Buffer.concat(chunks).toString("utf8");
	try {
		return text === "" ? null : JSON.parse(text);
	} catch {
		return null;
	}
}

function field(body: unknown, name: string): string {
	if (typeof body !== "object" || body === null) return "";
	const value: unknown = Reflect.get(body, name);
	return typeof value === "string" ? value : "";
}

/**
 * Account of a token: `acct:<sub>` (unit tests) or the `sub` of an
 * exchanged JWT (the fake IdP's, not verified: a fake).
 */
function accountOf(token: string): string | null {
	if (token.startsWith("acct:")) return token.slice("acct:".length);
	const payload = token.split(".")[1];
	if (token.split(".").length !== 3 || !payload) return null;
	try {
		const claims: unknown = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		);
		const sub = field(claims, "sub");
		return sub === "" ? null : sub;
	} catch {
		return null;
	}
}

/**
 * TEST ONLY. Tunelo's account API as Localman calls it (contract of
 * apps/tunelo-server/src/api/tunnel-list-routes.ts and link-routes.ts):
 * `GET /api/tunnels`, `POST /api/links/init|poll`, `DELETE /api/links/self`.
 */
export async function startFakeTunelo(port = 0): Promise<FakeTunelo> {
	const accounts = new Map<string, TuneloTunnel[]>();
	const devices = new Map<string, TuneloTunnel[]>();
	const pairings = new Map<string, Pairing>();
	const linkTokens = new Map<string, string>();
	const revokedTokens: string[] = [];
	const authorizations: string[] = [];
	const extensions: FakeRoute[] = [];
	let down = false;

	const bearer = (req: IncomingMessage): string => {
		const header = req.headers.authorization ?? "";
		authorizations.push(header);
		return header.startsWith("Bearer ") ? header.slice(7) : "";
	};

	const handle = async (req: IncomingMessage, res: ServerResponse) => {
		const body = await readBody(req);
		if (extensions.some((route) => route(req, res, body))) return;
		if (down) return send(res, 503, { error: "down" });
		const route = `${req.method} ${req.url}`;
		if (route === "GET /api/tunnels") {
			const token = bearer(req);
			const device = linkTokens.get(token);
			const sub = device === undefined ? accountOf(token) : null;
			if (device === undefined && sub === null) {
				return send(res, 401, { error: { code: "TUNELO_AUTH_001" } });
			}
			const tunnels =
				device === undefined ? accounts.get(sub ?? "") : devices.get(device);
			return send(res, 200, { tunnels: tunnels ?? [] });
		}
		if (route === "POST /api/links/init") {
			const requestId = randomBytes(24).toString("hex");
			const raw = randomBytes(4).toString("hex").toUpperCase();
			const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
			const expiresAt = Date.now() + LINK_TTL_MS;
			pairings.set(requestId, { code, expiresAt, deviceId: null });
			const iso = new Date(expiresAt).toISOString();
			return send(res, 200, { requestId, code, expiresAt: iso });
		}
		if (route === "POST /api/links/poll") {
			const requestId = field(body, "requestId");
			const pairing = pairings.get(requestId);
			if (!pairing || pairing.expiresAt < Date.now()) {
				return send(res, 200, { status: "expired" });
			}
			if (pairing.deviceId === null)
				return send(res, 200, { status: "pending" });
			pairings.delete(requestId);
			const token = `link_${randomBytes(16).toString("hex")}`;
			linkTokens.set(token, pairing.deviceId);
			const linkId = randomBytes(12).toString("hex");
			return send(res, 200, { status: "approved", token, linkId });
		}
		if (route === "DELETE /api/links/self") {
			const token = bearer(req);
			if (!linkTokens.delete(token)) return send(res, 401, { error: {} });
			revokedTokens.push(token);
			return send(res, 200, { ok: true });
		}
		send(res, 404, { error: { code: "NOT_FOUND" } });
	};

	const server: Server = createServer((req, res) => {
		handle(req, res).catch(() => send(res, 500, { error: "fake failed" }));
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => resolve());
	});
	const { port: bound } = server.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${bound}`,
		setAccountTunnels: (sub, tunnels) => accounts.set(sub, tunnels),
		setDeviceTunnels: (deviceId, tunnels) => devices.set(deviceId, tunnels),
		approve: (code, deviceId) => {
			const pairing = [...pairings.values()].find((p) => p.code === code);
			if (!pairing) return false;
			pairing.deviceId = deviceId;
			return true;
		},
		expirePairings: () => {
			for (const pairing of pairings.values()) pairing.expiresAt = 0;
		},
		revokeDevice: (deviceId) => {
			for (const [token, device] of linkTokens) {
				if (device === deviceId) linkTokens.delete(token);
			}
		},
		setDown: (value) => {
			down = value;
		},
		revokedTokens,
		authorizations,
		extend: (route) => extensions.push(route),
		close: () => {
			server.closeAllConnections();
			return new Promise((resolve) => server.close(() => resolve()));
		},
	};
}
