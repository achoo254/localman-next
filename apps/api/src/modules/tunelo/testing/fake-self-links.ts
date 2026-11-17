import { randomBytes } from "node:crypto";
import type { FakeTunelo } from "./fake-tunelo.js";

export interface FakeSelfLink {
	token: string;
	linkId: string;
	forwardUrl: string;
}

export interface FakeSelfLinks {
	/** What `POST /api/links/self` mints for `ownerSub`'s machine. */
	mint(ownerSub: string, deviceId: string, forwardUrl?: string): FakeSelfLink;
	/** The machine revokes its link: the token gets 401. */
	revoke(token: string): void;
	/** Tokens that revoked themselves (`DELETE /api/links/self`). */
	readonly revoked: readonly string[];
}

/** A machine tunnel's forward URL as Tunelo derives it (any stable name). */
export function fakeForwardUrl(deviceId: string): string {
	const label = `m-${Buffer.from(deviceId).toString("hex").slice(0, 30)}`;
	return `https://${label}.tunnel.hoandat.com/.tunelo/forward`;
}

/**
 * TEST ONLY. Adds an account's own links to the fake Tunelo:
 * `GET /api/links/self` answers whose machine a token is for, and its
 * tunnel list is empty (contract of apps/tunelo-server self-link-routes).
 */
export function useFakeSelfLinks(tunelo: FakeTunelo): FakeSelfLinks {
	const links = new Map<
		string,
		{ ownerSub: string; deviceId: string; linkId: string; forwardUrl: string }
	>();
	const revoked: string[] = [];
	const send = (
		res: Parameters<Parameters<FakeTunelo["extend"]>[0]>[1],
		status: number,
		body: unknown,
	): true => {
		res.writeHead(status, { "content-type": "application/json" });
		res.end(JSON.stringify(body));
		return true;
	};
	tunelo.extend((req, res) => {
		const header = req.headers.authorization ?? "";
		const link = links.get(header.replace(/^Bearer /, ""));
		if (req.method === "GET" && req.url === "/api/links/self") {
			if (!link) return send(res, 401, { error: { code: "TUNELO_AUTH_001" } });
			return send(res, 200, link);
		}
		if (req.method === "DELETE" && req.url === "/api/links/self" && link) {
			const token = header.replace(/^Bearer /, "");
			links.delete(token);
			revoked.push(token);
			return send(res, 200, { ok: true });
		}
		if (req.method === "GET" && req.url === "/api/tunnels" && link) {
			return send(res, 200, { tunnels: [] });
		}
		return false;
	});
	return {
		mint(ownerSub, deviceId, forwardUrl = fakeForwardUrl(deviceId)) {
			const token = `tunelo_${randomBytes(24).toString("hex")}`;
			const linkId = randomBytes(12).toString("hex");
			links.set(token, { ownerSub, deviceId, linkId, forwardUrl });
			return { token, linkId, forwardUrl };
		},
		revoke(token) {
			links.delete(token);
		},
		revoked,
	};
}
