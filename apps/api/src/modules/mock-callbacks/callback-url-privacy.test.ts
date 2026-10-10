import type { Client } from "@modelcontextprotocol/client";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import {
	TEST_PUBLIC_URL,
	type TestIdp,
	createTestIdp,
} from "../mcp/testing/idp-token-signer.js";
import {
	type RunningApp,
	connectMcpClient,
	createMcpTestApp,
	listenOnLoopback,
} from "../mcp/testing/localman-mcp-harness.js";
import { structuredOf } from "../mcp/testing/tool-structured-content.js";
import { RequestLogModel } from "../mock-runtime/request-log-model.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { createResource } from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { recordCallbackLine } from "./callback-message.js";
import {
	CallbackConfigModel,
	type StoredCallbackConfig,
} from "./callback-model.js";

useMockTestKit({ settings: () => ({ publicUrl: TEST_PUBLIC_URL }) });
const COLLAB = "acc_callback_url_collab";
/** A public IP literal: the guard passes it without a DNS lookup. */
const HOOK = "https://93.184.215.14/hook";
const SHOWN = `${HOOK}?[hidden]`;

let idp: TestIdp;
let running: RunningApp;
const clients: Client[] = [];
beforeAll(async () => {
	idp = await createTestIdp();
	running = await listenOnLoopback(createMcpTestApp(idp));
});
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});
afterAll(async () => {
	await running.close();
});

async function usersWithTokenUrl() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	const path = `/projects/${project.id}/resources/${users.id}/callbacks`;
	const put = (url: string) =>
		as(OWNER).send("put", path, {
			callbacks: [{ id: "cb1", on: "create", target: { kind: "url", url } }],
		});
	const set = await put(`${HOOK}?token=s3cret`);
	expect(set.status, JSON.stringify(set.body)).toBe(200);
	const stored = async () =>
		(
			await CallbackConfigModel.findOne({
				resourceId: users.id,
			}).lean<StoredCallbackConfig>()
		)?.callbacks[0]?.target;
	return { ...project, resourceId: users.id, path, put, stored };
}

describe("callback URL with a token in its query", () => {
	it("is whole for the owner, origin and path for members and MCP", async () => {
		const { id, resourceId, path } = await usersWithTokenUrl();
		const owner = await as(OWNER).get(path);
		expect(owner.body.callbacks[0].targetLabel).toBe(`${HOOK}?token=s3cret`);

		await UserModel.create({ sub: COLLAB, username: "collab" });
		await CollaboratorModel.create({
			projectId: new Types.ObjectId(id),
			inviteeUserId: COLLAB,
			status: "accepted",
			invitedBy: OWNER,
		});
		const member = await as(COLLAB).get(path);
		expect(member.body.callbacks[0]).toMatchObject({
			target: { kind: "url", url: SHOWN },
			targetLabel: SHOWN,
		});
		expect(JSON.stringify(member.body)).not.toContain("s3cret");

		const token = await idp.sign({ scope: "mock:read", sub: OWNER });
		const client = await connectMcpClient(running.url, token);
		clients.push(client);
		await client.callTool({
			name: "enable_toolset",
			arguments: { toolset: "traffic" },
		});
		const read = structuredOf(
			await client.callTool({
				name: "get_resource_callbacks",
				arguments: { projectId: id, resourceId },
			}),
		);
		expect(read).toMatchObject({ callbacks: [{ targetLabel: SHOWN }] });
		expect(JSON.stringify(read)).not.toContain("s3cret");
	});

	it("keeps the stored query when sent back as ?[hidden]", async () => {
		const { put, stored } = await usersWithTokenUrl();
		expect((await put(SHOWN)).status).toBe(200);
		expect(await stored()).toEqual({
			kind: "url",
			url: `${HOOK}?token=s3cret`,
		});
		// Another path never inherits the token.
		expect((await put(`${HOOK}/v2?[hidden]`)).status).toBe(200);
		expect(await stored()).toEqual({ kind: "url", url: `${HOOK}/v2?[hidden]` });
	});

	it("is logged as origin and path, and opens in no API client draft", async () => {
		const { id } = await usersWithTokenUrl();
		const project = {
			id: new Types.ObjectId(id),
			owner: OWNER,
			ownerPlan: { plan: "free" as const, planExpiresAt: null },
			redactHeaders: [],
		};
		const at = new Date();
		const message = {
			target: { kind: "url" as const, url: `${HOOK}?token=s3cret` },
			query: "",
			method: "POST",
			headers: [],
			body: null,
		};
		const result = {
			attempts: [{ at, error: "connect", ms: 1 }],
			response: null,
		};
		recordCallbackLine(project, at, "create", message, result);
		await requestLog.flush();
		const line = await RequestLogModel.findOne({ source: "callback" }).lean();
		expect(line).toMatchObject({ path: HOOK, target: HOOK, query: "" });
		expect(JSON.stringify(line)).not.toContain("s3cret");

		const draft = await as(OWNER).get(
			`/projects/${id}/request-logs/${line?._id.toHexString()}/draft`,
		);
		expect(draft.status).toBe(409);
		expect(draft.body.error.code).toBe("DRAFT_NOT_SUPPORTED");
	});
});
