import { request as httpRequest } from "node:http";
import {
	type CallToolResult,
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { Express } from "express";
import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { resourcesPath } from "../../resources/testing/resource-fixture.js";

/** TEST ONLY. An app listening on a random loopback port. */
export interface ListeningApp {
	readonly port: number;
	readonly origin: string;
	close(): Promise<void>;
}

export function listen(app: Express): Promise<ListeningApp> {
	return new Promise((resolve, reject) => {
		const server = app.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				reject(new Error("The test app has no TCP port"));
				return;
			}
			const { port } = address;
			resolve({
				port,
				origin: `http://127.0.0.1:${port}`,
				close: () =>
					new Promise((done) => {
						server.closeAllConnections();
						server.close(() => done());
					}),
			});
		});
	});
}

type Fetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * TEST ONLY. `fetch` that sends every request to `127.0.0.1:port` with
 * the URL's host in `Host` (undici's fetch would replace it), so a
 * client can address `{secret}.localman.test` without DNS.
 */
export function viaLoopback(port: number): Fetch {
	return (url, init = {}) => {
		const target = new URL(url);
		const headers = Object.fromEntries(new Headers(init.headers));
		const body = init.body;
		if (body !== undefined && body !== null && typeof body !== "string") {
			throw new Error("viaLoopback only sends string bodies");
		}
		return new Promise((resolve, reject) => {
			const req = httpRequest(
				{
					host: "127.0.0.1",
					port,
					method: init.method ?? "GET",
					path: `${target.pathname}${target.search}`,
					headers: { ...headers, host: target.host },
				},
				(res) => {
					const chunks: Buffer[] = [];
					res.on("data", (chunk: Buffer) => chunks.push(chunk));
					res.on("end", () => {
						const out = new Headers();
						for (const [name, value] of Object.entries(res.headers)) {
							if (typeof value === "string") out.set(name, value);
						}
						const status = res.statusCode ?? 500;
						const empty = status === 204 || chunks.length === 0;
						resolve(
							new Response(empty ? null : Buffer.concat(chunks), {
								status,
								headers: out,
							}),
						);
					});
				},
			);
			req.on("error", reject);
			if (body) req.write(body);
			req.end();
		});
	};
}

/** TEST ONLY. An SDK client on protocol 2026-07-28 connected to `url`. */
export async function connectMockMcp(
	url: string,
	options: { readonly token?: string; readonly fetch?: Fetch } = {},
): Promise<Client> {
	const client = new Client(
		{ name: "mock-mcp-test", version: "0.0.0" },
		{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
	);
	const transport = new StreamableHTTPClientTransport(new URL(url), {
		...(options.fetch ? { fetch: options.fetch } : {}),
		requestInit: options.token
			? { headers: { Authorization: `Bearer ${options.token}` } }
			: {},
	});
	await client.connect(transport);
	return client;
}

/** TEST ONLY. `error.code` of a failed tool call, `null` on success. */
export function errorCodeOf(result: CallToolResult): string | null {
	if (result.isError !== true) return null;
	const [first] = result.content;
	if (first?.type !== "text") return null;
	const body: unknown = JSON.parse(first.text);
	const error =
		typeof body === "object" && body !== null && "error" in body
			? body.error
			: null;
	return typeof error === "object" && error !== null && "code" in error
		? String(error.code)
		: null;
}

/** TEST ONLY. Replaces a resource's records through the dashboard API. */
export async function putData(
	sub: string,
	projectId: string,
	resourceId: string,
	data: object[],
): Promise<void> {
	const res = await as(sub).send(
		"put",
		resourcesPath(projectId, `/${resourceId}/data`),
		{ data },
	);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}
