import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import {
	StdioClientTransport,
	getDefaultEnvironment,
} from "@modelcontextprotocol/client/stdio";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
	type FakeTunnelServer,
	startFakeTunnelServer,
} from "../test-support/fake-tunnel-server.js";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = resolve(here, "../..");
// Inside the package so the bundle resolves its runtime deps like the real one.
const bundle = join(cliRoot, "node_modules/.cache/tunelo-mcp-test/cli.js");

let tunnelServer: FakeTunnelServer;
let app: http.Server;
let appPort: number;
let home: string;

function textOf(result: unknown): string {
	const content = (result as { content?: { type: string; text?: string }[] })
		.content;
	return content?.[0]?.text ?? "";
}

async function waitFor(check: () => boolean, ms = 5000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!check()) {
		if (Date.now() > deadline) throw new Error("condition not met in time");
		await new Promise((r) => setTimeout(r, 25));
	}
}

beforeAll(async () => {
	await build({
		entryPoints: [join(cliRoot, "src/cli.ts")],
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node20",
		outfile: bundle,
		packages: "external",
		alias: {
			"@tunelo/shared": resolve(cliRoot, "../tunelo-shared/src/index.ts"),
		},
		logLevel: "silent",
	});
	tunnelServer = await startFakeTunnelServer();
	app = http.createServer((_req, res) => res.end("hello from the local app"));
	await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
	const address = app.address();
	appPort = typeof address === "object" && address ? address.port : 0;
	home = mkdtempSync(join(tmpdir(), "tunelo-mcp-"));
});

afterAll(async () => {
	await tunnelServer.close();
	await new Promise<void>((r) => app.close(() => r()));
	rmSync(home, { recursive: true, force: true });
});

function connectClient(): { client: Client; transport: StdioClientTransport } {
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [bundle, "mcp", "--server", tunnelServer.wsUrl],
		env: {
			...getDefaultEnvironment(),
			HOME: home,
			TUNELO_KEY: "tunelo_mcp_test",
		},
		stderr: "ignore",
	});
	return { client: new Client({ name: "test", version: "0.0.0" }), transport };
}

describe("tunelo mcp over stdio", () => {
	test("opens a tunnel that serves the local app, lists and closes it", async () => {
		const { client, transport } = connectClient();
		await client.connect(transport);
		const tools = await client.listTools();
		expect(tools.tools.map((t) => t.name).sort()).toEqual([
			"close_tunnel",
			"list_local_tunnels",
			"open_http_tunnel",
			"open_tcp_tunnel",
			"tunnel_status",
			"whoami",
		]);
		expect(
			tools.tools.find((t) => t.name === "close_tunnel")?.annotations,
		).toMatchObject({
			destructiveHint: true,
		});

		const opened = await client.callTool({
			name: "open_http_tunnel",
			arguments: { port: appPort, subdomain: "agent-app" },
		});
		const tunnel = JSON.parse(textOf(opened)) as { id: string; url: string };
		expect(tunnel.url).toMatch(/\/t\/agent-app$/);
		expect(tunnelServer.authKeys).toContain("tunelo_mcp_test");

		const res = await fetch(`${tunnel.url}/`);
		expect(await res.text()).toBe("hello from the local app");

		const listed = await client.callTool({
			name: "list_local_tunnels",
			arguments: {},
		});
		expect(JSON.parse(textOf(listed)).tunnels).toHaveLength(1);

		await client.callTool({
			name: "close_tunnel",
			arguments: { id: tunnel.id },
		});
		await waitFor(() => tunnelServer.openSockets() === 0);
		await client.close();
	});

	test("every tunnel closes when the MCP process goes away", async () => {
		const { client, transport } = connectClient();
		await client.connect(transport);
		for (const subdomain of ["exit-a", "exit-b"]) {
			await client.callTool({
				name: "open_http_tunnel",
				arguments: { port: appPort, subdomain },
			});
		}
		await waitFor(() => tunnelServer.openSockets() === 2);
		await client.close();
		await waitFor(() => tunnelServer.openSockets() === 0);
	});

	test("refuses a TCP tunnel without a ttl", async () => {
		const { client, transport } = connectClient();
		await client.connect(transport);
		const result = await client.callTool({
			name: "open_tcp_tunnel",
			arguments: { port: appPort },
		});
		expect(result.isError).toBe(true);
		await client.close();
	});
});
