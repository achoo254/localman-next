import { buildTcpUrl, buildTunnelUrl } from "./config/tunnel-domains.js";
import { type PortAllocation, tcpPortManager } from "./tcp-port-manager.js";
import { currentTenantId } from "./tenancy/tunnel-tenant.js";
import { type TunnelConnection, tunnelManager } from "./tunnel-manager.js";
import type { TunnelOwner } from "./tunnel-owner.js";

/** One row of `GET /api/tunnels`. Never carries a key, hash or credential. */
export interface TunnelListItem {
	/** HTTP subdomain; null for TCP tunnels. */
	subdomain: string | null;
	url: string;
	protocol: "http" | "tcp";
	localPort: number | null;
	/** Public port of a TCP tunnel. */
	publicPort?: number;
	deviceName: string;
	/** ISO timestamp. */
	connectedAt: string;
	/** Whether visitors must pass Basic Auth. */
	basicAuth: boolean;
}

type HttpTunnel = Pick<
	TunnelConnection,
	"subdomain" | "owner" | "localPort" | "connectedAt" | "authHash"
>;
type TcpTunnel = Pick<
	PortAllocation,
	"port" | "localPort" | "allocatedAt" | "owner"
>;

/** Live registries; tests pass their own. */
export interface TunnelSources {
	http(): readonly HttpTunnel[];
	tcp(): readonly TcpTunnel[];
}

const liveSources: TunnelSources = {
	http: () => tunnelManager.getAllConnections(),
	// Ports are one range for every tenant: list the tenant's own only.
	tcp: () => {
		const tenantId = currentTenantId();
		return tcpPortManager.all().filter((t) => t.tenantId === tenantId);
	},
};

function listMatching(
	match: (owner: TunnelOwner) => boolean,
	sources: TunnelSources,
): TunnelListItem[] {
	const http = sources
		.http()
		.filter((t) => match(t.owner))
		.map(
			(t): TunnelListItem => ({
				subdomain: t.subdomain,
				url: buildTunnelUrl(t.subdomain),
				protocol: "http",
				localPort: t.localPort,
				deviceName: t.owner.deviceName,
				connectedAt: t.connectedAt.toISOString(),
				basicAuth: Boolean(t.authHash),
			}),
		);
	const tcp = sources
		.tcp()
		.filter((t) => match(t.owner))
		.map(
			(t): TunnelListItem => ({
				subdomain: null,
				url: buildTcpUrl(t.port),
				protocol: "tcp",
				localPort: t.localPort,
				publicPort: t.port,
				deviceName: t.owner.deviceName,
				connectedAt: t.allocatedAt.toISOString(),
				basicAuth: false,
			}),
		);
	return [...http, ...tcp];
}

/** Every tunnel an account has open, across all of its machines. */
export function listByOwner(
	ownerSub: string,
	sources: TunnelSources = liveSources,
): TunnelListItem[] {
	return listMatching((owner) => owner.ownerSub === ownerSub, sources);
}

/**
 * Tunnels an anonymous machine has open. Account-bound tunnels are excluded:
 * their device id is client-reported, so it must not leak into a link view.
 */
export function listByDeviceId(
	deviceId: string,
	sources: TunnelSources = liveSources,
): TunnelListItem[] {
	return listMatching(
		(owner) => owner.ownerSub === null && owner.deviceId === deviceId,
		sources,
	);
}
