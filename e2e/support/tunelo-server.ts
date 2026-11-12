/**
 * Child process of the E2E stack: the fake Tunelo on its fixed port, the
 * account API the Localman server calls (`TUNELO_API_URL`), plus control
 * routes for the specs (`tunelo-control.ts`):
 * - `GET /__e2e/health`;
 * - `PUT /__e2e/accounts/<sub>/tunnels` `{ tunnels }`: the account's tunnels.
 */
import type { ServerResponse } from "node:http";
import { startFakeTunelo } from "../../apps/api/src/modules/tunelo/testing/fake-tunelo.js";
import type { TuneloTunnel } from "../../apps/api/src/modules/tunelo/tunelo-api.js";
import { PORTS } from "./ports.js";

function reply(res: ServerResponse, status: number, body: unknown): true {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
	return true;
}

function tunnelsOf(body: unknown): TuneloTunnel[] {
	if (typeof body !== "object" || body === null) return [];
	const tunnels: unknown = Reflect.get(body, "tunnels");
	// The specs build the rows; the Localman server validates them anyway.
	return Array.isArray(tunnels) ? (tunnels as TuneloTunnel[]) : [];
}

const tunelo = await startFakeTunelo(PORTS.tunelo);
const ROW = /^\/__e2e\/accounts\/([^/]+)\/tunnels$/;

tunelo.extend((req, res, body) => {
	const url = req.url ?? "";
	if (!url.startsWith("/__e2e/")) return false;
	if (req.method === "GET" && url === "/__e2e/health") {
		return reply(res, 200, { ok: true });
	}
	const row = ROW.exec(url);
	if (req.method === "PUT" && row) {
		const sub = decodeURIComponent(row[1] ?? "");
		tunelo.setAccountTunnels(sub, tunnelsOf(body));
		return reply(res, 200, { ok: true });
	}
	return reply(res, 404, { error: "unknown control route" });
});
