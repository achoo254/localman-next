import { beforeEach, describe, expect, it } from "vitest";
import { USER_SCOPE } from "../../http/require-auth.js";
import { deletedWidgets } from "./__fixtures__/mcp-fixture-operations.js";
import {
	ALL_FIXTURE_SCOPES,
	connectTestClient,
	textJson,
} from "./__fixtures__/mcp-test-client.js";
import {
	CONFIRM_TOKEN_TTL_MS,
	createConfirmTokenService,
} from "./confirm-token.js";

type TestClient = Awaited<ReturnType<typeof connectTestClient>>["client"];

function deleteTree(client: TestClient, args: Record<string, unknown>) {
	return client.callTool({ name: "delete_widget_tree", arguments: args });
}

async function dryRunToken(
	client: TestClient,
	args: Record<string, unknown>,
): Promise<string> {
	const preview = await deleteTree(client, { ...args, dry_run: true });
	const body = textJson(preview);
	if (
		typeof body !== "object" ||
		body === null ||
		!("confirm_token" in body) ||
		typeof body.confirm_token !== "string"
	) {
		throw new Error("dry run returned no confirm_token");
	}
	return body.confirm_token;
}

function errorCode(result: Awaited<ReturnType<typeof deleteTree>>): unknown {
	const body = textJson(result);
	return typeof body === "object" && body !== null && "error" in body
		? body.error
		: undefined;
}

beforeEach(() => {
	deletedWidgets.length = 0;
});

describe("destructive tools: dry run and confirm_token", () => {
	it("dry run previews without changing anything and returns a token", async () => {
		const { client } = await connectTestClient();
		const preview = await deleteTree(client, { widgetId: "w1", dry_run: true });
		expect(preview.isError).toBeFalsy();
		// Claude Code shows agents only the structured result: the token is there.
		expect(preview.structuredContent).toEqual({
			dryRun: true,
			removed: 3,
			confirm_token: expect.any(String),
			confirm_token_expires_at: expect.any(String),
		});
		expect(textJson(preview)).toMatchObject({
			dry_run: true,
			preview: { dryRun: true, removed: 3 },
			confirm_token: expect.any(String),
		});
		expect(preview._meta?.["localman/confirm_token"]).toEqual(
			expect.any(String),
		);
		expect(deletedWidgets).toEqual([]);
	});

	it("declares the confirm token in the output schema of confirmed tools only", async () => {
		const { client } = await connectTestClient();
		const { tools } = await client.listTools();
		const propsOf = (name: string) =>
			Object.keys(
				tools.find((tool) => tool.name === name)?.outputSchema?.properties ??
					{},
			);
		expect(propsOf("delete_widget_tree")).toEqual(
			expect.arrayContaining(["confirm_token", "confirm_token_expires_at"]),
		);
		expect(propsOf("reset_widget")).not.toContain("confirm_token");
	});

	it("refuses the real call without a token", async () => {
		const { client } = await connectTestClient();
		const result = await deleteTree(client, { widgetId: "w1" });
		expect(result.isError).toBe(true);
		expect(errorCode(result)).toMatchObject({ code: "CONFIRMATION_REQUIRED" });
		expect(deletedWidgets).toEqual([]);
	});

	it("accepts the token once for the same (normalized) input", async () => {
		const { client } = await connectTestClient();
		const token = await dryRunToken(client, { widgetId: "w1" });
		// `cascade` defaults to true, so this is the same input.
		const done = await deleteTree(client, {
			widgetId: "w1",
			cascade: true,
			confirm_token: token,
		});
		expect(done.structuredContent).toEqual({ dryRun: false, removed: 3 });
		expect(deletedWidgets).toEqual(["w1"]);

		const reused = await deleteTree(client, {
			widgetId: "w1",
			confirm_token: token,
		});
		expect(errorCode(reused)).toMatchObject({ code: "CONFIRM_TOKEN_USED" });
		expect(deletedWidgets).toEqual(["w1"]);
	});

	it("rejects a token issued for another input, tool or user", async () => {
		const confirmTokens = createConfirmTokenService();
		const { client } = await connectTestClient({ confirmTokens });
		const token = await dryRunToken(client, { widgetId: "w1" });

		const otherInput = await deleteTree(client, {
			widgetId: "w2",
			confirm_token: token,
		});
		expect(errorCode(otherInput)).toMatchObject({
			code: "CONFIRM_TOKEN_INVALID",
		});
		const otherCascade = await deleteTree(client, {
			widgetId: "w1",
			cascade: false,
			confirm_token: token,
		});
		expect(errorCode(otherCascade)).toMatchObject({
			code: "CONFIRM_TOKEN_INVALID",
		});

		const { client: otherUser } = await connectTestClient({
			confirmTokens,
			caller: {
				auth: { subjectId: "user-2", scopes: [USER_SCOPE] },
				tokenScopes: ALL_FIXTURE_SCOPES,
				clientIp: null,
			},
		});
		const stolen = await deleteTree(otherUser, {
			widgetId: "w1",
			confirm_token: token,
		});
		expect(errorCode(stolen)).toMatchObject({ code: "CONFIRM_TOKEN_INVALID" });

		const garbage = await deleteTree(client, {
			widgetId: "w1",
			confirm_token: "not-a-token",
		});
		expect(errorCode(garbage)).toMatchObject({ code: "CONFIRM_TOKEN_INVALID" });
		expect(deletedWidgets).toEqual([]);
	});

	it("rejects an expired token", async () => {
		let now = 1_000_000;
		const confirmTokens = createConfirmTokenService({ now: () => now });
		const { client } = await connectTestClient({ confirmTokens });
		const token = await dryRunToken(client, { widgetId: "w1" });
		now += CONFIRM_TOKEN_TTL_MS;
		const late = await deleteTree(client, {
			widgetId: "w1",
			confirm_token: token,
		});
		expect(errorCode(late)).toMatchObject({ code: "CONFIRM_TOKEN_EXPIRED" });
		expect(deletedWidgets).toEqual([]);
	});

	it("does not burn the token when the policy refuses the caller", async () => {
		const { client } = await connectTestClient();
		const token = await dryRunToken(client, { widgetId: "w1" });
		const refused = await deleteTree(client, {
			widgetId: "not-mine",
			confirm_token: token,
		});
		expect(errorCode(refused)).toMatchObject({ code: "FORBIDDEN" });
		const done = await deleteTree(client, {
			widgetId: "w1",
			confirm_token: token,
		});
		expect(done.isError).toBeFalsy();
	});

	it("destructive tools without requiresConfirmation run directly", async () => {
		const { client } = await connectTestClient();
		const { tools } = await client.listTools();
		const reset = tools.find((tool) => tool.name === "reset_widget");
		expect(reset?.annotations?.destructiveHint).toBe(true);
		const real = await client.callTool({
			name: "reset_widget",
			arguments: { widgetId: "w1" },
		});
		expect(real.structuredContent).toEqual({ dryRun: false, reset: true });
		const preview = await client.callTool({
			name: "reset_widget",
			arguments: { widgetId: "w1", dry_run: true },
		});
		expect(preview.structuredContent).toEqual({ dryRun: true, reset: false });
		expect(preview._meta?.["localman/confirm_token"]).toBeUndefined();
	});

	it("non-destructive previews need no token", async () => {
		const { client } = await connectTestClient();
		const preview = await client.callTool({
			name: "preview_widget_colors",
			arguments: { color: "blue", dry_run: true },
		});
		expect(preview.structuredContent).toEqual({ dryRun: true });
		const real = await client.callTool({
			name: "preview_widget_colors",
			arguments: { color: "blue" },
		});
		expect(real.structuredContent).toEqual({ dryRun: false });
	});
});
