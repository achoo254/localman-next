import { randomBytes } from "node:crypto";
import { afterEach, beforeEach } from "vitest";
import { useDashboardTestDb } from "../../../test-support/dashboard-test-app.js";
import {
	type LogCapture,
	captureLogs,
} from "../../../test-support/log-capture.js";
import { TokenCipher, parseKeyring } from "../../auth/token-cipher.js";
import { type TuneloDeps, setTuneloDeps } from "../tunelo-runtime.js";
import { type FakeTunelo, startFakeTunelo } from "./fake-tunelo.js";

export const TEST_TUNNEL_DOMAINS = ["tunnel.hoandat.com"];

export interface TuneloTestEnv {
	readonly tunelo: FakeTunelo;
	readonly logs: LogCapture;
	readonly cipher: TokenCipher;
	/** Subjects whose session exchange throws. */
	readonly failExchange: Set<string>;
	/** What the test installed, to install again with changes. */
	readonly deps: TuneloDeps;
}

function testCipher(): TokenCipher {
	const keyring = parseKeyring(`k1:${randomBytes(32).toString("base64")}`);
	if (!keyring) throw new Error("test keyring is invalid");
	return new TokenCipher(keyring);
}

function required<T>(value: T | undefined, name: string): T {
	if (value === undefined) throw new Error(`${name} is read before a test`);
	return value;
}

/**
 * TEST ONLY. Mongo per file (tunnel domains set), and per test a fake
 * Tunelo with fresh deps (empty cache, new log capture). The session of
 * `as(sub)` (`session-<sub>`) exchanges for the account token `acct:<sub>`,
 * unless `sub` is in `failExchange`.
 */
export function useTuneloTestEnv(): TuneloTestEnv {
	useDashboardTestDb(() => ({ tunnelDomains: TEST_TUNNEL_DOMAINS }));
	const failExchange = new Set<string>();
	const state: {
		tunelo?: FakeTunelo;
		logs?: LogCapture;
		cipher?: TokenCipher;
		deps?: TuneloDeps;
	} = {};
	beforeEach(async () => {
		failExchange.clear();
		const tunelo = await startFakeTunelo();
		const logs = captureLogs("debug");
		const cipher = testCipher();
		const deps: TuneloDeps = {
			accountTokens: {
				accessTokenFor: async (sessionId) => {
					const sub = sessionId.replace(/^session-/, "");
					if (failExchange.has(sub)) throw new Error("exchange failed");
					return `acct:${sub}`;
				},
			},
			cipher,
			logger: logs.logger,
			apiUrl: tunelo.url,
			// Each test refreshes at will; the 2-second floor has its own test.
			refreshMinMs: 0,
		};
		Object.assign(state, { tunelo, logs, cipher, deps });
		setTuneloDeps(deps);
	});
	afterEach(async () => {
		await state.tunelo?.close();
	});
	return {
		get tunelo() {
			return required(state.tunelo, "tunelo");
		},
		get logs() {
			return required(state.logs, "logs");
		},
		get cipher() {
			return required(state.cipher, "cipher");
		},
		get deps() {
			return required(state.deps, "deps");
		},
		failExchange,
	};
}
