import {
	type CallToolResult,
	Client,
	InMemoryTransport,
} from "@modelcontextprotocol/client";
import { USER_SCOPE } from "../../../http/require-auth.js";
import { captureLogs } from "../../../test-support/log-capture.js";
import { createConfirmTokenService } from "../confirm-token.js";
import {
	type OperationMcpServerOptions,
	createOperationMcpServer,
} from "../operation-mcp-server.js";
import { fixtureOperations } from "./mcp-fixture-operations.js";

export const ALL_FIXTURE_SCOPES = [
	"mock:read",
	"mock:write",
	"admin:read",
	"users:write",
	"credentials:write",
];

type ServerOverrides = Partial<OperationMcpServerOptions>;

/**
 * TEST ONLY. Connects an SDK client to an operation MCP server over an
 * in-memory transport, as user `user-1` with every fixture scope.
 */
export async function connectTestClient(
	overrides: ServerOverrides & { readonly client?: Client } = {},
) {
	const logs = captureLogs();
	const server = createOperationMcpServer({
		serverInfo: { name: "localman-test", version: "0.0.0" },
		operations: fixtureOperations,
		caller: {
			auth: { subjectId: "user-1", scopes: [USER_SCOPE] },
			tokenScopes: ALL_FIXTURE_SCOPES,
			clientIp: "127.0.0.1",
		},
		logger: logs.logger,
		confirmTokens: createConfirmTokenService(),
		...overrides,
	});
	const client =
		overrides.client ?? new Client({ name: "test", version: "0.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	return { client, server, logs };
}

/** Text of the first content block, parsed as JSON. */
export function textJson(result: CallToolResult): unknown {
	const first = result.content[0];
	if (!first || first.type !== "text") throw new Error("no text content");
	return JSON.parse(first.text);
}
