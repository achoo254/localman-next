import type { WsOpenMessage } from "@tunelo/shared";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
	type FakeClient,
	type RelayServer,
	browserWs,
	connectClient,
	rawUpgrade,
	startRelayServer,
} from "../test-support/ws-app-harness.js";
import { tunnelManager } from "../tunnel-manager.js";
import { wsAppHandshakes } from "../ws-app-handshake.js";

const TIMEOUT_MS = 400;
let relay: RelayServer;
let seq = 0;
const clients: FakeClient[] = [];

beforeAll(async () => {
	relay = await startRelayServer(TIMEOUT_MS);
});
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});
afterAll(() => relay.close());

async function tunnel(
	options: { capable: boolean; auth?: string } = { capable: true },
): Promise<{ client: FakeClient; subdomain: string }> {
	const subdomain = `wsapp-${++seq}`;
	const client = await connectClient(relay.port, subdomain, options);
	clients.push(client);
	return { client, subdomain };
}

const b64 = (text: string): string => Buffer.from(text).toString("base64");

describe("browser WebSocket held until the app answers", () => {
	test("the app's 403 reaches the caller with its body, not a 101", async () => {
		const { client, subdomain } = await tunnel();
		const { response } = rawUpgrade(relay.port, subdomain);
		const open = (await client.next("ws-open")) as WsOpenMessage;
		expect(open.headers.origin).toBe("https://evil.example");
		client.send({
			type: "ws-open-result",
			id: open.id,
			ok: false,
			status: 403,
			statusText: "Forbidden\r\nx-injected: 1",
			headers: {
				"content-type": "text/plain",
				"x-reason": "origin",
				"x-split": "a\r\nset-cookie: stolen=1",
				"transfer-encoding": "chunked",
			},
			body: b64("Origin not allowed"),
		});
		const raw = await response;
		expect(raw.startsWith("HTTP/1.1 403 Forbidden\r\n")).toBe(true);
		expect(raw).toContain("x-reason: origin\r\n");
		expect(raw).toContain("content-length: 18\r\n");
		expect(raw.endsWith("\r\n\r\nOrigin not allowed")).toBe(true);
		expect(raw).not.toContain("x-injected");
		expect(raw).not.toContain("stolen");
		expect(raw).not.toContain("transfer-encoding");
	});

	test("an accepted handshake gets 101, the app's subprotocol and ordered frames", async () => {
		const { client, subdomain } = await tunnel();
		const ws = browserWs(relay.port, subdomain, ["chat.v1", "chat.v2"]);
		const got: string[] = [];
		ws.on("message", (data) => got.push(data.toString()));
		const open = (await client.next("ws-open")) as WsOpenMessage;
		expect(open.protocol).toMatch(/^chat\.v1, ?chat\.v2$/);
		// Sent before the result: held, then delivered first.
		client.send({
			type: "ws-data",
			id: open.id,
			data: b64("early"),
			binary: false,
		});
		client.send({
			type: "ws-open-result",
			id: open.id,
			ok: true,
			protocol: "chat.v2",
		});
		client.send({
			type: "ws-data",
			id: open.id,
			data: b64("welcome"),
			binary: false,
		});
		await new Promise<void>((resolve) => ws.once("open", resolve));
		expect(ws.protocol).toBe("chat.v2");

		const mark = client.received.length;
		ws.send("from-browser");
		const data = await client.next("ws-data", mark);
		expect(data).toMatchObject({ id: open.id, data: b64("from-browser") });
		for (const n of ["1", "2", "3"]) {
			client.send({
				type: "ws-data",
				id: open.id,
				data: b64(n),
				binary: false,
			});
		}
		await expect.poll(() => got).toEqual(["early", "welcome", "1", "2", "3"]);
		ws.close();
	});

	test("an app that never answers is reported as 504", async () => {
		const { client, subdomain } = await tunnel();
		const { response } = rawUpgrade(relay.port, subdomain);
		const open = (await client.next("ws-open")) as WsOpenMessage;
		expect(await response).toMatch(/^HTTP\/1\.1 504 Gateway Timeout\r\n/);
		expect(await client.next("ws-close")).toMatchObject({ id: open.id });
	});

	test("a browser leaving mid-wait closes the local WS and frees the slot", async () => {
		const { client, subdomain } = await tunnel();
		const { socket } = rawUpgrade(relay.port, subdomain);
		const open = (await client.next("ws-open")) as WsOpenMessage;
		const connectionId = tunnelManager.get(subdomain)?.connectionId ?? "";
		expect(wsAppHandshakes.countFor(connectionId)).toBe(1);
		socket.destroy();
		expect(await client.next("ws-close")).toMatchObject({
			id: open.id,
			code: 1001,
		});
		expect(wsAppHandshakes.countFor(connectionId)).toBe(0);
		// A late answer for the gone browser is ignored.
		client.send({ type: "ws-open-result", id: open.id, ok: true });
	});

	test("basic auth is still checked before the app is asked", async () => {
		const { client, subdomain } = await tunnel({ capable: true, auth: "u:p" });
		const { response } = rawUpgrade(relay.port, subdomain);
		expect(await response).toMatch(/^HTTP\/1\.1 401 Unauthorized\r\n/);
		expect(client.received.some((m) => m.type === "ws-open")).toBe(false);
	});

	test("a client without the capability gets the old 101-first behaviour", async () => {
		const { client, subdomain } = await tunnel({ capable: false });
		const { socket, response } = rawUpgrade(relay.port, subdomain);
		await client.next("ws-open");
		expect(await response).toMatch(/^HTTP\/1\.1 101 Switching Protocols\r\n/);
		socket.destroy();
	});
});
