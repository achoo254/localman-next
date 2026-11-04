import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import {
	CLIENT_CAPABILITIES,
	type WsCloseMessage,
	type WsDataMessage,
	type WsOpenResultMessage,
} from "@tunelo/shared";
import { afterAll, beforeAll, expect, test } from "vitest";
import { WebSocketServer } from "ws";
import { TunnelClient } from "./tunnel-client.js";
import { WsAppProxy } from "./ws-app-proxy.js";

type Sent = WsDataMessage | WsCloseMessage | WsOpenResultMessage;

let app: http.Server;
let appPort: number;
/** Frames the app received from the browser side. */
const appGot: string[] = [];
/** Upgrade sockets leave the HTTP server's bookkeeping; closed by hand. */
const upgraded = new Set<Duplex>();

beforeAll(async () => {
	const wss = new WebSocketServer({
		noServer: true,
		handleProtocols: (protocols) =>
			protocols.has("chat.v2") ? "chat.v2" : false,
	});
	wss.on("connection", (ws) => {
		ws.send("welcome");
		ws.on("message", (data) => appGot.push(data.toString()));
	});
	app = http.createServer();
	app.on("upgrade", (req, socket, head) => {
		upgraded.add(socket);
		if (req.url === "/forbidden") {
			const body = "Origin not allowed";
			socket.end(
				`HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\nx-reason: origin\r\ncontent-length: ${body.length}\r\n\r\n${body}`,
			);
			return;
		}
		if (req.url === "/hang") return;
		wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
	});
	await new Promise<void>((resolve) => app.listen(0, resolve));
	appPort = (app.address() as AddressInfo).port;
});

afterAll(() => {
	for (const socket of upgraded) socket.destroy();
	return new Promise<void>((resolve) => app.close(() => resolve()));
});

function proxyTo(port: number): { proxy: WsAppProxy; sent: Sent[] } {
	const sent: Sent[] = [];
	const proxy = new WsAppProxy(
		(msg) => sent.push(msg),
		() => port,
		{ handshakeTimeoutMs: 300 },
	);
	return { proxy, sent };
}

function open(proxy: WsAppProxy, path: string, protocol?: string): void {
	proxy.open({
		type: "ws-open",
		id: "w1",
		subdomain: "app",
		path,
		headers: { origin: "https://evil.example", "accept-encoding": "gzip" },
		protocol,
	});
}

const decode = (b64?: string): string =>
	Buffer.from(b64 ?? "", "base64").toString();

test("an app's refusal is reported with status, headers and body, then ws-close", async () => {
	const { proxy, sent } = proxyTo(appPort);
	open(proxy, "/forbidden");
	await expect.poll(() => sent.length).toBe(2);
	const [result, close] = sent;
	expect(result).toMatchObject({
		type: "ws-open-result",
		ok: false,
		status: 403,
	});
	if (result?.type !== "ws-open-result" || result.ok)
		throw new Error("no refusal");
	expect(result.statusText).toBe("Forbidden");
	expect(result.headers?.["x-reason"]).toBe("origin");
	expect(decode(result.body)).toBe("Origin not allowed");
	// Older servers know only ws-close; it still follows the result.
	expect(close).toMatchObject({ type: "ws-close", id: "w1", code: 1006 });
});

test("an open local WS reports ok and its subprotocol before any frame", async () => {
	const { proxy, sent } = proxyTo(appPort);
	open(proxy, "/ok", "chat.v1, chat.v2");
	proxy.data({
		type: "ws-data",
		id: "w1",
		data: btoa("queued"),
		binary: false,
	});
	await expect.poll(() => sent.length).toBe(2);
	expect(sent[0]).toEqual({
		type: "ws-open-result",
		id: "w1",
		ok: true,
		protocol: "chat.v2",
	});
	expect(sent[1]).toMatchObject({ type: "ws-data", id: "w1" });
	expect(decode((sent[1] as WsDataMessage).data)).toBe("welcome");
	await expect.poll(() => appGot).toContain("queued");
	proxy.closeAll();
});

test("an app that never answers the handshake is reported as 504", async () => {
	const { proxy, sent } = proxyTo(appPort);
	open(proxy, "/hang");
	await expect.poll(() => sent.length, { timeout: 3000 }).toBe(2);
	expect(sent[0]).toMatchObject({
		type: "ws-open-result",
		ok: false,
		status: 504,
	});
	expect(sent[1]).toMatchObject({ type: "ws-close", id: "w1" });
});

test("an unreachable app is reported as 502", async () => {
	const probe = http.createServer();
	await new Promise<void>((resolve) => probe.listen(0, resolve));
	const deadPort = (probe.address() as AddressInfo).port;
	await new Promise<void>((resolve) => probe.close(() => resolve()));

	const { proxy, sent } = proxyTo(deadPort);
	open(proxy, "/ok");
	await expect.poll(() => sent.length).toBe(2);
	expect(sent[0]).toMatchObject({
		type: "ws-open-result",
		ok: false,
		status: 502,
	});
});

test("the tunnel client declares that it sends ws-open-result", async () => {
	const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
	const auth = new Promise<Record<string, unknown>>((resolve) => {
		server.on("connection", (ws) =>
			ws.once("message", (raw) => resolve(JSON.parse(raw.toString()))),
		);
	});
	await new Promise<void>((resolve) => server.once("listening", resolve));
	const { port } = server.address() as AddressInfo;
	const client = new TunnelClient({
		serverUrl: `http://127.0.0.1:${port}`,
		apiKey: "k",
		localPort: 1,
	});
	client.connect().catch(() => undefined);
	expect((await auth).capabilities).toEqual([
		CLIENT_CAPABILITIES.WS_OPEN_RESULT,
	]);
	client.disconnect();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});
