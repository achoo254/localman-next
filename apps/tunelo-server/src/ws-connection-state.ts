import type { KeyInfo } from "./key-store/key-store-types.js";
import type { TcpConnectionState } from "./tcp-ws-handler.js";
import type { TunnelOwner } from "./tunnel-owner.js";

/** Per-connection state attached after upgrade */
export interface ConnectionState {
	id: string;
	/** Set once an auth message is being handled; later ones are ignored. */
	authStarted: boolean;
	authenticated: boolean;
	subdomain: string;
	keyInfo: KeyInfo | null;
	owner: TunnelOwner | null;
	messageCount: number;
	rateLimitInterval: ReturnType<typeof setInterval>;
	authTimer: ReturnType<typeof setTimeout>;
	pingInterval: ReturnType<typeof setInterval> | null;
	tcpState: TcpConnectionState;
	alive: boolean;
}
