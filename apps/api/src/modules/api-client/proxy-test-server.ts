import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll } from "vitest";
import {
	type ResolvedAddress,
	type SsrfGuard,
	type SsrfGuardOptions,
	createSsrfGuard,
} from "./ssrf-guard.js";

/** What the echo route saw, as JSON. */
export interface EchoBody {
	readonly method: string;
	readonly path: string;
	/** `rawHeaders` pairs: order, case and repeats as received. */
	readonly headers: [string, string][];
	readonly bodyBase64: string;
}

export type TestRoute = (
	req: IncomingMessage,
	res: ServerResponse,
	body: Buffer,
) => void;

function echo(req: IncomingMessage, res: ServerResponse, body: Buffer): void {
	const headers: [string, string][] = [];
	for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
		headers.push([req.rawHeaders[i] ?? "", req.rawHeaders[i + 1] ?? ""]);
	}
	const answer: EchoBody = {
		method: req.method ?? "",
		path: req.url ?? "",
		headers,
		bodyBase64: body.toString("base64"),
	};
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(answer));
}

export interface TestServer {
	/** `http://127.0.0.1:<port>` */
	readonly origin: string;
	readonly port: number;
	/** Routes by path (without query); unknown paths echo the request. */
	readonly routes: Map<string, TestRoute>;
}

/**
 * TEST ONLY. A target server on 127.0.0.1 for the proxy, started for the
 * file. Every request is echoed unless a route answers its path.
 */
export function useTestServer(): TestServer {
	const routes = new Map<string, TestRoute>();
	const server = http.createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			const path = (req.url ?? "/").split("?")[0] ?? "/";
			(routes.get(path) ?? echo)(req, res, Buffer.concat(chunks));
		});
	});
	const state = { origin: "", port: 0, routes };
	beforeAll(async () => {
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const { port } = server.address() as AddressInfo;
		state.port = port;
		state.origin = `http://127.0.0.1:${port}`;
	});
	afterAll(async () => {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});
	return state;
}

/** Test host names and the addresses they resolve to. */
export const TEST_HOSTS: Readonly<Record<string, ResolvedAddress[]>> = {
	"echo.test": [{ address: "127.0.0.1", family: 4 }],
	"private.test": [{ address: "192.168.1.10", family: 4 }],
	"mixed.test": [
		{ address: "93.184.215.14", family: 4 },
		{ address: "10.0.0.1", family: 4 },
	],
	"public.test": [{ address: "93.184.215.14", family: 4 }],
	// Mock hosts under `mock.test`; 93.184.215.14 plays the server's own IP.
	"mock.test": [{ address: "93.184.215.14", family: 4 }],
	"abc.mock.test": [{ address: "93.184.215.14", family: 4 }],
	"priv.mock.test": [{ address: "10.0.0.5", family: 4 }],
	"srv.mock.test": [{ address: "127.0.0.1", family: 4 }],
};

/** Plays the server's own public address in tests. */
export const TEST_SERVER_IP = "93.184.215.14";

/** Resolver over `TEST_HOSTS`; other names fail like NXDOMAIN. */
export async function testResolver(
	hostname: string,
): Promise<ResolvedAddress[]> {
	const found = TEST_HOSTS[hostname];
	if (!found)
		throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
	return found;
}

/**
 * TEST ONLY. The real guard over `TEST_HOSTS`, with 127.0.0.1 let through
 * so the test server is reachable; every other blocked range still holds.
 */
export function testGuard(options: SsrfGuardOptions = {}): SsrfGuard {
	return createSsrfGuard({
		resolve: testResolver,
		allowAddresses: ["127.0.0.1"],
		...options,
	});
}

/** The echo body of a proxied response. */
export function echoOf(body: string): EchoBody {
	const parsed: unknown = JSON.parse(body);
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("headers" in parsed) ||
		!Array.isArray(parsed.headers) ||
		!("method" in parsed) ||
		typeof parsed.method !== "string" ||
		!("path" in parsed) ||
		typeof parsed.path !== "string" ||
		!("bodyBase64" in parsed) ||
		typeof parsed.bodyBase64 !== "string"
	) {
		throw new Error("Not an echo body");
	}
	const headers = parsed.headers.filter(
		(pair): pair is [string, string] =>
			Array.isArray(pair) && pair.every((part) => typeof part === "string"),
	);
	const { method, path, bodyBase64 } = parsed;
	return { method, path, headers, bodyBase64 };
}

/** Values of header `name` (any case) as the target received them. */
export function headerValues(echoBody: EchoBody, name: string): string[] {
	const wanted = name.toLowerCase();
	return echoBody.headers
		.filter(([n]) => n.toLowerCase() === wanted)
		.map(([, v]) => v);
}
