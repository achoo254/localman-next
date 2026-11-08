/**
 * Opens a machine tunnel to a local WebSocket echo server through a real
 * Tunelo relay, then measures round trips from outside: client → relay →
 * tunnel → local echo → back. Run from the repo root:
 *
 *   pnpm --filter @tunelo/client exec tsx scripts/ws-echo-roundtrip.ts \
 *     --session <path/to/session.json> [--server https://tunnel.hoandat.com] \
 *     [--login] [--count 50]
 *
 * `--login` signs in with the device flow first (open the printed link);
 * the session is kept at `--session` and refreshed from there.
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { WebSocket, WebSocketServer } from "ws";
import {
	TunnelClient,
	accountTokenFor,
	deviceSignIn,
	fileSessionStore,
	serverIdentity,
} from "../src/index.js";

const { values } = parseArgs({
	options: {
		session: { type: "string" },
		server: { type: "string", default: "https://tunnel.hoandat.com" },
		login: { type: "boolean", default: false },
		count: { type: "string", default: "50" },
	},
});
const say = (line: string): void => {
	process.stdout.write(`${line}\n`);
};

if (!values.session) throw new Error("--session <path> is required");
const serverUrl = values.server;
const count = Number(values.count);
const store = fileSessionStore(values.session);

if (values.login || !store.load()) {
	const issuer = serverIdentity(serverUrl)?.issuer;
	if (!issuer) throw new Error(`No sign-in known for ${serverUrl}`);
	await deviceSignIn({
		issuer,
		store,
		onCode: (a) => {
			say(`Sign in: ${a.verificationUriComplete ?? a.verificationUri}`);
			say(`Code: ${a.userCode}`);
		},
	});
}

const echo = new WebSocketServer({ host: "127.0.0.1", port: 0 });
echo.on("connection", (socket) => {
	socket.on("message", (data, binary) => socket.send(data, { binary }));
});
await new Promise<void>((resolve) => echo.once("listening", resolve));
const address = echo.address();
const localPort = typeof address === "object" && address ? address.port : 0;

const client = new TunnelClient({
	serverUrl,
	getApiKey: accountTokenFor(store, serverUrl),
	kind: "machine",
	deviceId: randomUUID(),
	deviceName: "ws-echo-roundtrip",
	localPort,
	localHost: "127.0.0.1",
});
client.on("error", (err: Error) => say(`tunnel error: ${err.message}`));

try {
	const { url } = await client.connect();
	say(`Tunnel ${url} → ws://127.0.0.1:${localPort}`);
	const remote = new WebSocket(url.replace(/^http/, "ws"));
	await new Promise<void>((resolve, reject) => {
		remote.once("open", () => resolve());
		remote.once("error", reject);
	});
	const samples: number[] = [];
	for (let i = 0; i < count; i++) {
		const sent = performance.now();
		await new Promise<void>((resolve) => {
			remote.once("message", () => resolve());
			remote.send(`ping ${i}`);
		});
		samples.push(performance.now() - sent);
	}
	remote.close();
	samples.sort((a, b) => a - b);
	const at = (q: number): string =>
		(
			samples[Math.min(samples.length - 1, Math.floor(q * samples.length))] ?? 0
		).toFixed(1);
	say(
		`${count} round trips: p50 ${at(0.5)} ms, p95 ${at(0.95)} ms, max ${at(1)} ms`,
	);
} finally {
	client.disconnect();
	echo.close();
}
