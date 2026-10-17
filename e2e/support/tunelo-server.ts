/**
 * Child process of the E2E stack: the fake Tunelo on its fixed port, the
 * account API the Localman server calls (`TUNELO_API_URL`), plus control
 * routes for the specs (`tunelo-control.ts`):
 * - `GET /__e2e/health`;
 * - `PUT /__e2e/accounts/<sub>/tunnels` `{ tunnels }`: the account's tunnels;
 * - `PUT /__e2e/devices/<id>/tunnels` `{ tunnels }`: an anonymous machine's;
 * - `POST /__e2e/links/approve` `{ code, deviceId }`: `tunelo link <code>`.
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

function stringField(body: unknown, name: string): string {
	if (typeof body !== "object" || body === null) return "";
	const value: unknown = Reflect.get(body, name);
	return typeof value === "string" ? value : "";
}

const tunelo = await startFakeTunelo(PORTS.tunelo);
const ROW = /^\/__e2e\/(accounts|devices)\/([^/]+)\/tunnels$/;

tunelo.extend((req, res, body) => {
	const url = req.url ?? "";
	if (!url.startsWith("/__e2e/")) return false;
	if (req.method === "GET" && url === "/__e2e/health") {
		return reply(res, 200, { ok: true });
	}
	const row = ROW.exec(url);
	if (req.method === "PUT" && row) {
		const id = decodeURIComponent(row[2] ?? "");
		if (row[1] === "accounts") tunelo.setAccountTunnels(id, tunnelsOf(body));
		else tunelo.setDeviceTunnels(id, tunnelsOf(body));
		return reply(res, 200, { ok: true });
	}
	if (req.method === "POST" && url === "/__e2e/links/approve") {
		const approved = tunelo.approve(
			stringField(body, "code"),
			stringField(body, "deviceId"),
		);
		return reply(res, approved ? 200 : 404, { approved });
	}
	return reply(res, 404, { error: "unknown control route" });
});
