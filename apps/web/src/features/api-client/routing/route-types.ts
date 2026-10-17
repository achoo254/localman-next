/**
 * What the router needs from the page around it, injected so the send
 * logic stays testable without React: the account's routing settings,
 * this browser's CORS cache, and a way to ask before credentials go
 * through the proxy.
 */
import type {
	PreparedRequest,
	RequestSettings,
} from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import type { TunnelChoices } from "../tunelo/auto-tunnel";
import type { LocalTunnel } from "../tunelo/tunelo-accounts-api";
import type { ProxyHopOutcome } from "../workbench/proxy-hop";
import type { RouteWhy, SendRoute } from "../workbench/workbench-types";
import type { CorsCache } from "./cors-cache";
import type { DirectOptions, DirectOutcome } from "./direct-fetch";

/** The account's settings as the router reads them for one send. */
export interface RoutingSnapshot {
	/** Hosts pinned to the proxy (`host[:port]`, lower case). */
	pinnedHosts: ReadonlySet<string>;
	/**
	 * Hosts where credentials may go through the proxy without asking: the
	 * host the proxy calls, so a tunnel's host rather than the local key.
	 */
	secretHosts: ReadonlySet<string>;
	/** Enabled tunnel mappings: local key (`localhost:3000`) → tunnel origin. */
	tunnels: ReadonlyMap<string, string>;
}

/** "May these credentials go through the proxy (or a tunnel)?" */
export interface SecretAsk {
	/**
	 * Host the proxy calls (the tunnel's host for a tunnel): what "Don't ask
	 * again" remembers, so a mapping changed later asks again.
	 */
	host: string;
	/** Origin the proxy calls: the tunnel URL, or the target's origin. */
	url: string;
	/** The target as typed: its host, or the local key (`localhost:3000`). */
	target: string;
	/** Credential names (`Authorization`, `{{token}}`), never values. */
	parts: string[];
	route: Exclude<SendRoute, "direct">;
	why: RouteWhy;
}

/** "Which tunnel should this local address use?" */
export interface TunnelPick {
	/** Local target key (`localhost:3000`). */
	key: string;
	/** The HTTP tunnels of its port, two or more. */
	tunnels: LocalTunnel[];
}

/**
 * The user's own Tunelo tunnels (flag `tuneloAccounts`), used for a local
 * target without an enabled manual mapping.
 */
export interface AutoTunnels {
	/** Tunnels of `port`; `null` when they cannot be read (as none). */
	list: (port: number, refresh: boolean) => Promise<LocalTunnel[] | null>;
	/** Resolves `null` when the user cancels (or the send is). */
	choose: (
		pick: TunnelPick,
		signal: AbortSignal,
	) => Promise<LocalTunnel | null>;
	choices: TunnelChoices;
}

export interface RouterDeps {
	scripts: ScriptRunner;
	snapshot: () => Promise<RoutingSnapshot>;
	corsCache: Pick<CorsCache, "has" | "remember">;
	/** Resolves `false` when the user declines (or the send is cancelled). */
	confirmSecrets: (ask: SecretAsk, signal: AbortSignal) => Promise<boolean>;
	/** Off without the `tuneloAccounts` flag: no automatic tunnel. */
	autoTunnels?: AutoTunnels;
	/** Defaults to `fetch` from the browser; tests pass their own. */
	direct?: (
		prepared: PreparedRequest,
		options: DirectOptions,
	) => Promise<DirectOutcome>;
	/** Defaults to `POST /api/v1/proxy`; tests pass their own. */
	proxy?: (
		prepared: PreparedRequest,
		settings: RequestSettings,
		signal: AbortSignal,
	) => Promise<ProxyHopOutcome>;
}

export const EMPTY_SNAPSHOT: RoutingSnapshot = {
	pinnedHosts: new Set(),
	secretHosts: new Set(),
	tunnels: new Map(),
};
