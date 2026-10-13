import type {
	StreamMessage,
	TunnelRequest,
	TunnelResponse,
} from "@tunelo/shared";
import { DEFAULTS, ErrorCode } from "@tunelo/shared";
import type { WebSocket } from "ws";
import { purgeSubdomain } from "./cache/response-cache.js";
import { createLogger } from "./logger.js";
import { StreamRegistry, type StreamSink } from "./stream/stream-registry.js";
import { currentTenantId, tenantKey } from "./tenancy/tunnel-tenant.js";
import { checkBasicAuth, hashCredentials } from "./tunnel-auth-checker.js";
import type { TunnelOwner } from "./tunnel-owner.js";
import { safeSend } from "./ws-send.js";

const logger = createLogger("tunelo-tunnel-manager");

interface PendingRequest {
	resolve: (res: TunnelResponse) => void;
	reject: (err: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export interface TunnelConnection {
	socket: WebSocket;
	/** Unique connection ID for tracking across reconnects */
	connectionId: string;
	/** SHA-256 hash of the API key used to authenticate */
	apiKeyHash: string;
	/** User ID from KeyStore (MongoDB ObjectId or dev placeholder) */
	userId: string;
	/** API key ID from KeyStore */
	keyId: string;
	subdomain: string;
	/** Tenant whose domain the tunnel is on; maps key by tenant and subdomain. */
	tenantId: string;
	connectedAt: Date;
	pendingRequests: Map<string, PendingRequest>;
	/** SHA-256 hash of "user:pass" for Basic Auth — undefined means no auth required */
	authHash?: string;
	owner: TunnelOwner;
	/** Port on the client machine; null when an older CLI did not send it. */
	localPort: number | null;
}

export interface RegisterTunnelInput {
	subdomain: string;
	socket: WebSocket;
	connectionId: string;
	apiKeyHash: string;
	userId: string;
	keyId: string;
	owner: TunnelOwner;
	localPort: number | null;
	/** Basic auth "user:pass" required from visitors, if any. */
	auth?: string;
}

/**
 * Open tunnels of every tenant. Maps are keyed by `tenantKey(subdomain)`
 * (the same subdomain in two tenants is two tunnels); methods taking a
 * subdomain run in the request's tenant, counts and lists only see it.
 */
class TunnelManager {
	private tunnels = new Map<string, TunnelConnection>();
	/** Pending requests preserved during reconnect grace period */
	private orphanedRequests = new Map<string, Map<string, PendingRequest>>();
	/** Grace period timers — reject orphaned requests after timeout */
	private graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	/** In-flight response streams keyed by request id (live HTTP relay path). */
	private streams = new StreamRegistry();

	register(input: RegisterTunnelInput): boolean {
		const { subdomain, auth } = input;
		const key = tenantKey(subdomain);
		// If tunnel exists with a different socket, reject (subdomain taken)
		if (this.tunnels.has(key)) return false;

		const authHash = auth ? hashCredentials(auth) : undefined;

		// Recover orphaned pending requests from a previous disconnect (grace period reconnect)
		const orphaned = this.orphanedRequests.get(key);
		const pendingRequests = orphaned ?? new Map<string, PendingRequest>();

		if (orphaned) {
			// Clear grace timer — client reconnected in time
			const graceTimer = this.graceTimers.get(key);
			if (graceTimer) clearTimeout(graceTimer);
			this.graceTimers.delete(key);
			this.orphanedRequests.delete(key);
			logger.info(
				{ subdomain, recoveredRequests: orphaned.size },
				"Recovered pending requests after reconnect",
			);
		} else {
			// Fresh tunnel session (not a grace-period reconnect) — drop any stale
			// cached responses so a restarted local app never serves old assets.
			void purgeSubdomain(subdomain);
		}

		this.tunnels.set(key, {
			socket: input.socket,
			connectionId: input.connectionId,
			apiKeyHash: input.apiKeyHash,
			userId: input.userId,
			keyId: input.keyId,
			subdomain,
			tenantId: currentTenantId(),
			connectedAt: new Date(),
			pendingRequests,
			authHash,
			owner: input.owner,
			localPort: input.localPort,
		});

		logger.info(
			{ subdomain, recovered: orphaned?.size ?? 0 },
			"Tunnel registered",
		);
		return true;
	}

	/** Unregisters the tunnel stored under `key` (a `tenantKey`). */
	private unregisterKey(key: string): void {
		const tunnel = this.tunnels.get(key);
		if (!tunnel) return;
		const { subdomain } = tunnel;

		const pendingCount = tunnel.pendingRequests.size;
		this.tunnels.delete(key);

		if (pendingCount > 0) {
			// Move pending requests to orphaned — give client time to reconnect
			this.orphanedRequests.set(key, tunnel.pendingRequests);
			logger.info(
				{ subdomain, pendingCount },
				"Tunnel disconnected, grace period started",
			);

			const graceTimer = setTimeout(() => {
				const orphaned = this.orphanedRequests.get(key);
				if (!orphaned) return;

				// Grace period expired — reject all orphaned requests
				for (const [id, pending] of orphaned) {
					clearTimeout(pending.timer);
					pending.reject(
						new Error(`Tunnel disconnected [${ErrorCode.TUNNEL_NOT_FOUND}]`),
					);
				}
				orphaned.clear();
				this.orphanedRequests.delete(key);
				this.graceTimers.delete(key);
				logger.info(
					{ subdomain, rejectedCount: pendingCount },
					"Grace period expired, requests rejected",
				);
			}, DEFAULTS.RECONNECT_GRACE_MS);

			this.graceTimers.set(key, graceTimer);
		} else {
			logger.info({ subdomain }, "Tunnel unregistered");
		}
	}

	get(subdomain: string): TunnelConnection | undefined {
		return this.tunnels.get(tenantKey(subdomain));
	}

	has(subdomain: string): boolean {
		return this.tunnels.has(tenantKey(subdomain));
	}

	/** Unregister all subdomains associated with a specific connection */
	unregisterByConnectionId(connectionId: string): void {
		// Fail in-flight streams first — an open response can't survive a reconnect.
		this.streams.cleanupByConnection(connectionId);
		const keys: string[] = [];
		for (const [key, tunnel] of this.tunnels) {
			if (tunnel.connectionId === connectionId) keys.push(key);
		}
		for (const key of keys) this.unregisterKey(key);
	}

	/** Check if subdomain is in grace period (disconnected but waiting for reconnect) */
	isInGracePeriod(subdomain: string): boolean {
		return this.orphanedRequests.has(tenantKey(subdomain));
	}

	sendRequest(
		subdomain: string,
		request: TunnelRequest,
	): Promise<TunnelResponse> {
		const key = tenantKey(subdomain);
		const tunnel = this.tunnels.get(key);
		if (!tunnel) return Promise.reject(new Error(`No tunnel for ${subdomain}`));

		return new Promise<TunnelResponse>((resolve, reject) => {
			const timer = setTimeout(() => {
				tunnel.pendingRequests.delete(request.id);
				// Also check orphaned requests
				const orphaned = this.orphanedRequests.get(key);
				if (orphaned) orphaned.delete(request.id);
				reject(new Error(`Request timeout [${ErrorCode.REQUEST_TIMEOUT}]`));
			}, DEFAULTS.REQUEST_TIMEOUT_MS);

			tunnel.pendingRequests.set(request.id, { resolve, reject, timer });
			safeSend(tunnel.socket, request);
		});
	}

	/**
	 * Relay a request and stream its response back through `sink`. This is the
	 * live HTTP relay path — nothing is buffered whole, so SSE / chunked / large
	 * responses flow straight to the browser.
	 */
	openStream(
		subdomain: string,
		request: TunnelRequest,
		sink: StreamSink,
	): void {
		const tunnel = this.tunnels.get(tenantKey(subdomain));
		if (!tunnel) {
			sink.onError(new Error(`No tunnel for ${subdomain}`));
			return;
		}
		this.streams.register(request.id, tunnel.connectionId, sink);
		safeSend(tunnel.socket, request);
	}

	/** Route streaming frames (stream-start/data/end/error) from a client. */
	handleStreamFrame(connectionId: string, frame: StreamMessage): void {
		this.streams.push(connectionId, frame);
	}

	/** Downstream consumer (e.g. browser) went away — tell the client to stop producing. */
	cancelStream(subdomain: string, id: string): void {
		if (!this.streams.has(id)) return;
		this.streams.drop(id);
		const tunnel = this.tunnels.get(tenantKey(subdomain));
		if (tunnel) {
			safeSend(tunnel.socket, {
				type: "stream-error",
				id,
				message: "client aborted",
			});
		}
	}

	/** Handle a response from a client: only requests sent over its own connection match. */
	handleResponseByConnectionId(
		connectionId: string,
		response: TunnelResponse,
	): void {
		// Try all subdomains belonging to this connection
		for (const tunnel of this.tunnels.values()) {
			if (tunnel.connectionId !== connectionId) continue;
			const pending = tunnel.pendingRequests.get(response.id);
			if (pending) {
				clearTimeout(pending.timer);
				tunnel.pendingRequests.delete(response.id);
				pending.resolve(response);
				return;
			}
		}
		// Orphaned requests are answered only after their tunnel reconnects
		// (register adopts them), never by another connection.
		// A streaming client that sent a single legacy "response" — adapt it to
		// the start → data → end lifecycle so the open stream sink completes.
		this.streams.pushLegacyResponse(connectionId, response);
	}

	/** Check if request passes Basic Auth for the given tunnel */
	checkAuth(subdomain: string, authHeader: string | undefined): boolean {
		const tunnel = this.tunnels.get(tenantKey(subdomain));
		return checkBasicAuth(tunnel?.authHash, authHeader);
	}

	/** Count active tunnels using a specific API key hash */
	countByKeyHash(keyHash: string): number {
		let count = 0;
		for (const tunnel of this.inTenant()) {
			if (tunnel.apiKeyHash === keyHash) count++;
		}
		return count;
	}

	/** Count active tunnels opened by an account (any machine) */
	countByOwner(ownerSub: string): number {
		let count = 0;
		for (const tunnel of this.inTenant()) {
			if (tunnel.owner.ownerSub === ownerSub) count++;
		}
		return count;
	}

	/** Count active tunnels for a specific user */
	countByUserId(userId: string): number {
		let count = 0;
		for (const tunnel of this.inTenant()) {
			if (tunnel.userId === userId) count++;
		}
		return count;
	}

	/** Disconnect and unregister all tunnels using a specific API key hash */
	disconnectByKeyHash(keyHash: string): void {
		const tenantId = currentTenantId();
		const keys: string[] = [];
		for (const [key, tunnel] of this.tunnels) {
			if (tunnel.apiKeyHash === keyHash && tunnel.tenantId === tenantId) {
				keys.push(key);
			}
		}
		for (const key of keys) {
			this.tunnels.get(key)?.socket.close();
			this.unregisterKey(key);
		}
		if (keys.length > 0) {
			logger.info(
				{ keyHash: keyHash.slice(0, 8), count: keys.length },
				"Disconnected tunnels by key hash",
			);
		}
	}

	/** Open tunnels of the tenant in scope. */
	private inTenant(): TunnelConnection[] {
		const tenantId = currentTenantId();
		return [...this.tunnels.values()].filter((t) => t.tenantId === tenantId);
	}

	/** The tenant's active tunnel connections (tunnel lists). */
	getAllConnections(): TunnelConnection[] {
		return this.inTenant();
	}

	/** Health: how many tunnels are open, never whose. */
	/** Tunnels of every tenant: the loopback health check of the process. */
	getStats(): { activeTunnels: number } {
		return { activeTunnels: this.tunnels.size };
	}

	/** Tunnels of the current tenant: what its own apex `/health` reports. */
	getTenantStats(): { activeTunnels: number } {
		const tenantId = currentTenantId();
		let activeTunnels = 0;
		for (const tunnel of this.tunnels.values()) {
			if (tunnel.tenantId === tenantId) activeTunnels++;
		}
		return { activeTunnels };
	}

	closeAll(): void {
		// Clear all grace timers
		for (const [, timer] of this.graceTimers) clearTimeout(timer);
		this.graceTimers.clear();

		// Reject all orphaned requests
		for (const [, orphaned] of this.orphanedRequests) {
			for (const [, pending] of orphaned) {
				clearTimeout(pending.timer);
				pending.reject(new Error("Server shutting down"));
			}
		}
		this.orphanedRequests.clear();

		for (const [key, tunnel] of this.tunnels) {
			this.streams.cleanupByConnection(tunnel.connectionId);
			tunnel.socket.close();
			this.unregisterKey(key);
		}
	}
}

export const tunnelManager = new TunnelManager();
