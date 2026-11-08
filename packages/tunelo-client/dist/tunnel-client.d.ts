import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { type TunnelKind } from "./shared/constants.js";
import { type AuthResult } from "./shared/protocol.js";
import type { TunnelMapping } from "./tunnel-config-parser.js";
export interface TunnelClientOptions {
    /** Tunelo server, e.g. `https://tunnel.hoandat.com`. */
    serverUrl: string;
    /** Called before every connect and reconnect, e.g. to refresh an account
     *  access token (`accountTokenFor`). An error with `fatal: true` stops
     *  reconnecting. The library never reads credentials on its own. */
    getApiKey: () => Promise<string>;
    /** Reported to the server so an account can tell its machines apart;
     *  required for `kind: "machine"`, whose subdomain it keys. */
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    /** `machine`: a background agent's tunnel, held for this account and
     *  `deviceId` under a quota of its own (see `TUNNEL_KINDS`). */
    kind?: TunnelKind | undefined;
    /** Authenticate without opening an HTTP tunnel (TCP-only clients). */
    tcpOnly?: boolean | undefined;
    /** Requested subdomain; for `machine`, the one granted before. */
    subdomain?: string | undefined;
    /** Local port the tunnel forwards HTTP and WebSocket traffic to. */
    localPort: number;
    /**
     * Report `localPort` to the server in the auth frame (default true): it
     * lists the tunnel as serving that port of the machine. A machine tunnel
     * whose port is the process's own (not an app of the user) sets false.
     */
    reportLocalPort?: boolean | undefined;
    localHost?: string | undefined;
    /** Basic auth credentials "user:pass" */
    auth?: string | undefined;
    /** Additional tunnels to register after initial auth */
    additionalTunnels?: TunnelMapping[] | undefined;
    /** Keepalive probe period (ms). Overridden only by tests — the wait for a
     *  missed pong is two of these, and the default makes that a full minute. */
    pingIntervalMs?: number | undefined;
    /** Cap on one connect attempt (ms). Overridden only by tests. */
    connectTimeoutMs?: number | undefined;
}
export declare class TunnelClient extends EventEmitter {
    private socket;
    private stopped;
    private attempts;
    /** Guards against more than one retry loop running at a time. */
    private reconnecting;
    private readonly options;
    /** Maps subdomain → local port for multi-tunnel routing */
    private subdomainPortMap;
    /** In-flight response streams keyed by request id (for cancel/cleanup). */
    private activeStreams;
    /** Browser→app WebSocket relay: opens a local WS per `ws-open` and bridges frames. */
    private readonly wsAppProxy;
    constructor(options: TunnelClientOptions);
    /** Resolves the token first, so each (re)connect uses a fresh one. */
    connect(): Promise<AuthResult>;
    private open;
    disconnect(): void;
    /** False once disconnected or given up (e.g. the sign-in expired). */
    isActive(): boolean;
    /** Register a TCP tunnel after auth */
    registerTcp(localPort: number, remotePort?: number): void;
    /** Get raw socket for TcpProxy to attach handlers */
    getSocket(): WebSocket | null;
    /** Send a JSON message over the WebSocket */
    sendMsg(msg: unknown): void;
    private buildWsUrl;
    private handleAuthResult;
    private handleRegisterTunnelResult;
    private handleTcpRegisterResult;
    private registerAdditionalTunnels;
    private handleRequest;
    private reconnect;
}
