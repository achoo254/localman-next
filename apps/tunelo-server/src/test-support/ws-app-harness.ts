/**
 * A real tunnel server plus a hand-driven tunnel client, for exercising the
 * browser→app WebSocket relay message by message.
 */
import http from "node:http";
import net from "node:net";
import { CLIENT_CAPABILITIES, type TunnelMessage } from "@tunelo/shared";
import { WebSocket } from "ws";
import { createIdpTokenVerifier } from "../auth/idp-token-verifier.js";
import { createTokenAuthenticator } from "../auth/token-authenticator.js";
import { attachWsHandler } from "../ws-handler.js";
import { FakeKeyStore } from "./fake-key-store.js";
import { TEST_AUDIENCE, TEST_ISSUER, createTestIdp } from "./idp-test-keys.js";

export const TEST_DOMAIN = "tunnel.example.test";
const LEGACY = `tunelo_${"c".repeat(48)}`;

export interface RelayServer {
	port: number;
	close(): Promise<void>;
}

export async function startRelayServer(
	wsOpenResultTimeoutMs: number,
): Promise<RelayServer> {
	const idp = await createTestIdp();
	const keyStore = new FakeKeyStore();
	keyStore.add(LEGACY, { kind: "legacy", deviceId: "dev-ws" });
	const authenticator = createTokenAuthenticator({
		config: {
			mode: "hybrid",
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			legacyCutoffMs: null,
		},
		keyStore,
		verifier: createIdpTokenVerifier({
			issuer: TEST_ISSUER,
			audience: TEST_AUDIENCE,
			keys: idp.keys,
		}),
	});
	const server = http.createServer();
	attachWsHandler(server, authenticator, { wsOpenResultTimeoutMs });
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	return {
		port,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
}

/** The tunnel client side of a control channel, driven by the test. */
export interface FakeClient {
	/** Every message the server sent, in order. */
	received: TunnelMessage[];
	send(msg: Record<string, unknown>): void;
	/** Resolves with the first received message matching `type` from `from`. */
	next(type: string, from?: number): Promise<TunnelMessage>;
	close(): void;
}

export async function connectClient(
	port: number,
	subdomain: string,
	options: { capable: boolean; auth?: string },
): Promise<FakeClient> {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/tunnel`, {
		headers: { host: TEST_DOMAIN },
	});
	const received: TunnelMessage[] = [];
	const waiters: Array<() => void> = [];
	ws.on("message", (data) => {
		received.push(JSON.parse(data.toString()) as TunnelMessage);
		for (const wake of waiters.splice(0)) wake();
	});
	const client: FakeClient = {
		received,
		send: (msg) => ws.send(JSON.stringify(msg)),
		next: (type, from = 0) =>
			new Promise((resolve) => {
				const check = (): void => {
					const hit = received.slice(from).find((m) => m.type === type);
					if (hit) resolve(hit);
					else waiters.push(check);
				};
				check();
			}),
		close: () => ws.close(),
	};
	await new Promise<void>((resolve, reject) => {
		ws.once("open", resolve);
		ws.once("error", reject);
	});
	client.send({
		type: "auth",
		key: LEGACY,
		subdomain,
		...(options.auth ? { auth: options.auth } : {}),
		...(options.capable
			? { capabilities: [CLIENT_CAPABILITIES.WS_OPEN_RESULT] }
			: {}),
	});
	const result = await client.next("auth-result");
	if (result.type !== "auth-result" || !result.success) {
		throw new Error("tunnel auth failed");
	}
	return client;
}

/** A raw browser upgrade: the socket, and everything the server wrote. */
export function rawUpgrade(
	port: number,
	subdomain: string,
	extraHeaders: string[] = [],
): { socket: net.Socket; response: Promise<string> } {
	const request = [
		"GET /ws?x=1 HTTP/1.1",
		`Host: ${subdomain}.${TEST_DOMAIN}`,
		"Upgrade: websocket",
		"Connection: Upgrade",
		"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
		"Sec-WebSocket-Version: 13",
		"Origin: https://evil.example",
		...extraHeaders,
		"",
		"",
	].join("\r\n");
	const socket = net.connect(port, "127.0.0.1", () => socket.write(request));
	const response = new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		socket.on("data", (c: Buffer) => {
			chunks.push(c);
			// A 101 keeps the socket open; the status line is all we need.
			if (Buffer.concat(chunks).toString().startsWith("HTTP/1.1 101")) {
				resolve(Buffer.concat(chunks).toString());
			}
		});
		socket.on("close", () => resolve(Buffer.concat(chunks).toString()));
		socket.on("error", reject);
	});
	return { socket, response };
}

/** A real browser-like WS client through the tunnel. */
export function browserWs(
	port: number,
	subdomain: string,
	protocols: string[],
): WebSocket {
	return new WebSocket(`ws://127.0.0.1:${port}/ws`, protocols, {
		headers: { host: `${subdomain}.${TEST_DOMAIN}` },
	});
}
