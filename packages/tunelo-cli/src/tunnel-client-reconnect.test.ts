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
 * Accepts the first auth, drops that socket, then rejects every later auth the
 * way the server does while it still holds the old tunnel ("Subdomain already
 * in use"). Returns the timestamps at which the client opened each connection.
 */
async function runRejectingServer(windowMs: number): Promise<number[]> {
	const openedAt: number[] = [];
	const t0 = Date.now();
	let seen = 0;

	wss = new WebSocketServer({ port: 0 });
	const { port } = wss.address() as { port: number };

	wss.on("connection", (ws) => {
		seen++;
		const nth = seen;
		openedAt.push(Date.now() - t0);

		ws.on("message", (raw) => {
			const msg = JSON.parse(raw.toString());
			if (msg.type !== "auth") return;

			if (nth === 1) {
				ws.send(
					JSON.stringify({
						type: "auth-result",
						success: true,
						subdomain: "repro",
						url: "https://repro.tunnel.example.test",
					}),
				);
				setTimeout(() => ws.close(), 100);
				return;
			}

			ws.send(
				JSON.stringify({
					type: "auth-result",
					success: false,
					subdomain: "repro",
					url: "",
					error: "Subdomain already in use",
				}),
			);
		});
	});

	client = new TunnelClient({
		serverUrl: `http://127.0.0.1:${port}`,
		apiKey: "k",
		subdomain: "repro",
		localPort: 1,
	});
	client.on("error", () => {});
	await client.connect();

	await new Promise((r) => setTimeout(r, windowMs));
	return openedAt;
}

test(
	"a rejected auth does not fork a second retry loop",
	async () => {
		const openedAt = await runRejectingServer(3500);

		// Base delay is 1s and doubles, so a single loop can only fit the initial
		// connect plus about two retries into this window. The forked-loop bug
		// produced connections in pairs and roughly doubled that count.
		expect(openedAt.length).toBeLessThanOrEqual(4);

		// No two attempts land together — that pairing was the forked loops.
		const gaps = openedAt.slice(1).map((at, i) => at - openedAt[i]);
		for (const gap of gaps) expect(gap).toBeGreaterThan(200);
	},
	{ timeout: 15_000 },
);

test(
	"backoff keeps growing across retries",
	async () => {
		const openedAt = await runRejectingServer(5000);
		const gaps = openedAt.slice(1).map((at, i) => at - openedAt[i]);

		expect(gaps.length).toBeGreaterThanOrEqual(2);
		// Jitter is +-25% around each step, so a doubled step always outgrows the
		// one before it even at opposite extremes.
		expect(gaps[1]).toBeGreaterThan(gaps[0]);
	},
	{ timeout: 15_000 },
);
