import { OperationError } from "@localman/operations";
import type { Logger } from "../../logger.js";
import type { AuthModule } from "../auth/auth-module.js";
import type { TokenCipher } from "../auth/token-cipher.js";
import { tunnelResource } from "../auth/token-exchange.js";
import {
	type FetchLike,
	type TuneloApi,
	createTuneloApi,
} from "./tunelo-api.js";
import { TunnelListCache } from "./tunnel-list-cache.js";

/** Session → Tunelo account token (`TunnelTokenExchange` in production). */
export interface AccountTunnelTokens {
	accessTokenFor(sessionId: string): Promise<string>;
}

export interface TuneloDeps {
	readonly accountTokens: AccountTunnelTokens;
	/** Seals link tokens at rest (the session keyring). */
	readonly cipher: TokenCipher;
	readonly logger: Logger;
	/** `TUNELO_API_URL`: one Tunelo for every tenant (dev, E2E). */
	readonly apiUrl?: string;
	/**
	 * A refresh younger list than this is reused (`TUNNEL_REFRESH_MIN_MS`
	 * by default); tests set their own.
	 */
	readonly refreshMinMs?: number;
	/** Defaults to the global `fetch`; tests pass their own. */
	readonly fetch?: FetchLike;
}

export interface TuneloRuntime {
	readonly deps: TuneloDeps;
	readonly cache: TunnelListCache;
	/** The Tunelo of the request's tenant (`https://tunnel.<domain>`). */
	api(): TuneloApi;
}

let current: TuneloRuntime | undefined;

/**
 * Installs what the Tunelo operations need. Operations are declared
 * statically in the registry, so they reach the token exchange, cipher and
 * HTTP client through here; `main.ts` (and tests) install them at startup.
 * Installing again starts with an empty tunnel cache.
 */
export function setTuneloDeps(deps: TuneloDeps): void {
	const fetchImpl: FetchLike =
		deps.fetch ?? ((input, init) => fetch(input, init));
	current = {
		deps,
		cache: new TunnelListCache(),
		api: () => createTuneloApi(deps.apiUrl ?? tunnelResource(), fetchImpl),
	};
}

/** Startup: the auth module's token exchange and cipher. */
export function configureTunelo(
	auth: Pick<AuthModule, "tunnelTokens" | "tokenCipher">,
	apiUrl: string | undefined,
	logger: Logger,
): void {
	setTuneloDeps({
		accountTokens: auth.tunnelTokens,
		cipher: auth.tokenCipher,
		logger,
		apiUrl,
	});
}

/** 503 when the server was started without Tunelo (never in `main.ts`). */
export function tuneloRuntime(): TuneloRuntime {
	if (!current) {
		throw new OperationError(
			503,
			"TUNELO_UNAVAILABLE",
			"Tunelo is not configured on this server",
		);
	}
	return current;
}
