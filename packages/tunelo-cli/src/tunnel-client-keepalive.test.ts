import { createServer } from "node:net";
import { afterEach, expect, test } from "vitest";
import { WebSocketServer } from "ws";
import { TunnelClient } from "./tunnel-client.js";

let wss: WebSocketServer | undefined;
let client: TunnelClient | undefined;

afterEach(async () => {
	client?.disconnect();
	client = undefined;
	await new Promise<void>((resolve) => {
		if (!wss) return resolve();
		wss.close(() => resolve());
	});
	wss = undefined;
});

/**
 * A server that grants the tunnel and then goes silent the way a dropped NAT
 * flow does: `autoPong: false` means our probes are never answered, and the
 * server never closes the socket, so the client gets no "close" event to react
 * to. Only the client's own probe can notice.
 */
function startDeafServer(): Promise<{ port: number; connections: number[] }> {
	return new Promise((resolve) => {
		const connections: number[] = [];
		const t0 = Date.now();

		wss = new WebSocketServer({ port: 0, autoPong: false });
		wss.on("connection", (ws) => {
			connections.push(Date.now() - t0);
			ws.on("message", (raw) => {
				const msg = JSON.parse(raw.toString());
				if (msg.type !== "auth") return;
				ws.send(
					JSON.stringify({
						type: "auth-result",
						success: true,
						subdomain: "deaf",
						url: "https://deaf.tunnel.example.test",
					}),
				);
			});
		});
		wss.on("listening", () => {
			const { port } = wss?.address() as { port: number };
			resolve({ port, connections });
		});
	});
}

test(
	"a peer that stops answering probes is dropped and reconnected",
	async () => {
		const { port, connections } = await startDeafServer();

		const disconnects: number[] = [];
		client = new TunnelClient({
			serverUrl: `http://127.0.0.1:${port}`,
			apiKey: "k",
			subdomain: "deaf",
			localPort: 1,
			pingIntervalMs: 150,
		});
		client.on("error", () => {});
		client.on("disconnected", () => disconnects.push(Date.now()));
		await client.connect();

		// Two probe periods take the socket down: the first sends, the second
		// finds the pong missing. Allow generous slack, then a reconnect.
		await new Promise((r) => setTimeout(r, 2500));

		expect(disconnects.length).toBeGreaterThanOrEqual(1);
		// Before this fix the client sat on the dead socket forever, so the
		// server only ever saw the one connection.
		expect(connections.length).toBeGreaterThanOrEqual(2);
	},
	{ timeout: 15_000 },
);

test(
	"a healthy peer is left alone",
	async () => {
		const connections: number[] = [];
		await new Promise<void>((resolve) => {
			// autoPong defaults on, so `ws` answers every probe for us.
			wss = new WebSocketServer({ port: 0 });
			wss.on("connection", (ws) => {
				connections.push(Date.now());
				ws.on("message", (raw) => {
					const msg = JSON.parse(raw.toString());
					if (msg.type !== "auth") return;
					ws.send(
						JSON.stringify({
							type: "auth-result",
							success: true,
							subdomain: "healthy",
							url: "https://healthy.tunnel.example.test",
						}),
					);
				});
			});
			wss.on("listening", () => resolve());
		});
		const { port } = wss?.address() as { port: number };

		let disconnected = 0;
		client = new TunnelClient({
			serverUrl: `http://127.0.0.1:${port}`,
			apiKey: "k",
			subdomain: "healthy",
			localPort: 1,
			pingIntervalMs: 150,
		});
		client.on("error", () => {});
		client.on("disconnected", () => disconnected++);
		await client.connect();

		await new Promise((r) => setTimeout(r, 1500));

		// ~10 probe periods with no drop — the guard must not fire on a live peer.
		expect(disconnected).toBe(0);
		expect(connections.length).toBe(1);
	},
	{ timeout: 15_000 },
);

test(
	"a connect attempt that never completes is capped, not left to the kernel",
	async () => {
		// Accept the TCP connection and then say nothing. The handshake can never
		// finish, exactly like a path that swallows packets after the SYN — the
		// case that stalled a real reconnect for 135s against a DROP rule.
		// Keep the accepted sockets so teardown can destroy them: `close()` waits
		// for open connections, and a stalled one never ends on its own.
		const held: import("node:net").Socket[] = [];
		const deaf = createServer((sock) => {
			held.push(sock);
		});
		await new Promise<void>((resolve) => deaf.listen(0, "127.0.0.1", resolve));
		const { port } = deaf.address() as { port: number };

		client = new TunnelClient({
			serverUrl: `http://127.0.0.1:${port}`,
			apiKey: "k",
			subdomain: "stalled",
			localPort: 1,
			connectTimeoutMs: 300,
		});
		client.on("error", () => {});

		const started = Date.now();
		await expect(client.connect()).rejects.toThrow();
		const elapsed = Date.now() - started;

		// Generous ceiling: the point is that something caps it at all. Uncapped,
		// this sits until the OS gives up.
		expect(elapsed).toBeLessThan(3000);

		for (const sock of held) sock.destroy();
		await new Promise<void>((resolve) => deaf.close(() => resolve()));
	},
	{ timeout: 15_000 },
);
