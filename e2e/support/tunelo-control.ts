import type { TuneloTunnel } from "../../apps/api/src/modules/tunelo/tunelo-api.js";
import { TUNELO_ORIGIN } from "./ports.js";

async function control(
	method: string,
	path: string,
	body: unknown,
): Promise<void> {
	const res = await fetch(`${TUNELO_ORIGIN}/__e2e${path}`, {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`Fake Tunelo ${method} ${path}: ${res.status}`);
}

/** Tunnels the fake Tunelo lists for the account `sub` (`acc_<username>`). */
export function setAccountTunnels(
	sub: string,
	tunnels: TuneloTunnel[],
): Promise<void> {
	return control("PUT", `/accounts/${encodeURIComponent(sub)}/tunnels`, {
		tunnels,
	});
}

/** An HTTP tunnel of `localPort` at `https://<name>.tunnel.hoandat.com`. */
export function httpTunnel(
	name: string,
	localPort: number,
	deviceName: string,
): TuneloTunnel {
	return {
		subdomain: name,
		url: `https://${name}.tunnel.hoandat.com`,
		protocol: "http",
		localPort,
		deviceName,
		connectedAt: new Date().toISOString(),
		basicAuth: false,
	};
}
