import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach } from "vitest";
import {
	type TestServer,
	testGuard,
	useTestServer,
} from "../../api-client/proxy-test-server.js";
import { ownerTunnelUrl } from "../../mock-runtime/upstream-target.js";
import { type OutboundDeps, defaultOutboundDeps } from "../outbound-send.js";
import { OutboundQueue } from "../retry-queue.js";

/** TEST ONLY. Waits between attempts, short enough for tests. */
export const TEST_BACKOFF_MS: readonly number[] = [30, 90];

/** A request the fake tunnel received. */
export interface Received {
	readonly method: string;
	readonly url: string;
	readonly headers: IncomingMessage["headers"];
	readonly body: string;
	readonly at: number;
}

export interface OutboundTestKit {
	readonly server: TestServer;
	/** What the fake tunnel received, in order (emptied before each test). */
	readonly received: Received[];
	readonly deps: OutboundDeps;
	/** A queue with `deps` (fresh per test, never started). */
	queue(): OutboundQueue;
	/** Answers `path` with `status`, recording each request. */
	answer(path: string, status: number, body?: string): void;
}

/**
 * TEST ONLY. A fake tunnel on 127.0.0.1: the owner's `localhost:3000`
 * maps to it, `localhost:5000` to a closed port, any other port to the
 * owner's real mappings (none in tests). The SSRF guard lets 127.0.0.1
 * through, every other private range stays blocked.
 */
export function useOutboundTestKit(): OutboundTestKit {
	const server = useTestServer();
	const received: Received[] = [];
	const deps = defaultOutboundDeps({
		guard: testGuard(),
		timeoutMs: 2_000,
		backoffMs: TEST_BACKOFF_MS,
		findTunnel: async (owner, port) => {
			if (port === 3000) return server.origin;
			if (port === 5000) return "http://127.0.0.1:1";
			return ownerTunnelUrl(owner, port);
		},
	});
	let queue = new OutboundQueue({ deps, pollMs: 10 });
	beforeEach(() => {
		received.length = 0;
		server.routes.clear();
		queue = new OutboundQueue({ deps, pollMs: 10 });
	});
	afterEach(() => queue.stop());
	return {
		server,
		received,
		deps,
		queue: () => queue,
		answer: (path, status, body = "ok") => {
			server.routes.set(path, (req, res, bytes) => {
				received.push({
					method: req.method ?? "",
					url: req.url ?? "",
					headers: req.headers,
					body: bytes.toString(),
					at: Date.now(),
				});
				res.statusCode = status;
				res.end(body);
			});
		},
	};
}
