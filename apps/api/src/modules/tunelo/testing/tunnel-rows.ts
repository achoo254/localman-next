import type { TuneloTunnel } from "../tunelo-api.js";

/** TEST ONLY. An HTTP tunnel row as Tunelo lists it. */
export function httpTunnel(
	name: string,
	localPort: number,
	overrides: Partial<TuneloTunnel> = {},
): TuneloTunnel {
	return {
		subdomain: name,
		url: `https://${name}.tunnel.hoandat.com`,
		protocol: "http",
		localPort,
		deviceName: "dev-laptop",
		connectedAt: "2026-10-17T08:00:00.000Z",
		basicAuth: false,
		...overrides,
	};
}
