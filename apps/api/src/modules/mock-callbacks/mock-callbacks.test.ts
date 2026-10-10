import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import {
	RequestLogModel,
	type StoredRequestLog,
} from "../mock-runtime/request-log-model.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { OutboundJobModel } from "./outbound-job-model.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();

const callbacksPath = (projectId: string, resourceId: string) =>
	`/projects/${projectId}/resources/${resourceId}/callbacks`;

const toTunnel = (path: string) => ({ kind: "tunnel", port: 3000, path });

async function usersWithCallbacks(callbacks: object[]) {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	const path = callbacksPath(project.id, users.id);
	const set = await as(OWNER).send("put", path, { callbacks });
	expect(set.status, JSON.stringify(set.body)).toBe(200);
	return {
		...project,
		path,
		resourceId: users.id,
		mock: kit.client(project.secret),
	};
}

async function callbackLines(): Promise<StoredRequestLog[]> {
	await requestLog.flush();
	return RequestLogModel.find({ source: "callback" })
		.sort({ _id: 1 })
		.lean<StoredRequestLog[]>();
}

describe("mock callbacks", () => {
	it("sends the rendered template when the mock creates a record", async () => {
		outbound.answer("/hooks/users", 200);
		const { id, path, mock } = await usersWithCallbacks([
			{
				on: "create",
				target: toTunnel("/hooks/users"),
				bodyTemplate:
					'{"event":"{{event}}","in":"{{resource}}","name":"{{record.name}}","record":{{record}}}',
				headers: [{ name: "X-Hook-Secret", value: "s3" }],
			},
			{ on: "delete", target: toTunnel("/hooks/users") },
		]);
		const created = await mock.call("post", "/users", { name: "Ada" });
		expect(created.status).toBe(201);
		await outbound.queue().drain();

		expect(outbound.received).toHaveLength(1);
		const [sent] = outbound.received;
		expect(sent?.method).toBe("POST");
		expect(sent?.url).toBe("/hooks/users");
		expect(sent?.headers["content-type"]).toBe("application/json");
		expect(sent?.headers["x-hook-secret"]).toBe("s3");
		expect(sent?.headers["x-localman-proxy"]).toBe("1");
		expect(JSON.parse(sent?.body ?? "")).toEqual({
			event: "create",
			in: "users",
			name: "Ada",
			record: created.body,
		});

		const [line] = await callbackLines();
		expect(line).toMatchObject({
			method: "POST",
			path: "tunnel:3000/hooks/users",
			status: 200,
			event: "create",
			target: "tunnel:3000/hooks/users",
			attempts: [expect.objectContaining({ status: 200 })],
		});
		const read = await as(OWNER).get(path);
		expect(read.body.callbacks[0].last).toMatchObject({
			ok: true,
			status: 200,
		});
		expect(read.body.callbacks[1].last).toBeNull();
		// The request went out of the mock: nothing to replay into it.
		const lineId = line?._id.toHexString() ?? "";
		const replay = await as(OWNER).send(
			"post",
			`/projects/${id}/request-logs/${lineId}/replay`,
		);
		expect(replay.status).toBe(409);
		expect(replay.body.error.code).toBe("REPLAY_NOT_SUPPORTED");
	});

	it("retries a failing target 3 times with backoff", async () => {
		outbound.answer("/hooks/fail", 503);
		const { path, mock } = await usersWithCallbacks([
			{ on: "create", target: toTunnel("/hooks/fail") },
		]);
		await mock.call("post", "/users", { name: "Bo" });
		await outbound.queue().drain();
		const times = outbound.received.map((r) => r.at);
		expect(times).toHaveLength(3);
		expect((times[1] ?? 0) - (times[0] ?? 0)).toBeGreaterThanOrEqual(25);
		expect((times[2] ?? 0) - (times[1] ?? 0)).toBeGreaterThanOrEqual(85);
		const [line] = await callbackLines();
		expect(line?.attempts?.map((a) => a.status)).toEqual([503, 503, 503]);
		const read = await as(OWNER).get(path);
		expect(read.body.callbacks[0].last).toMatchObject({
			ok: false,
			status: 503,
		});
	});

	it("fires nothing for writes from a Localman hop or the dashboard", async () => {
		outbound.answer("/hooks/users", 200);
		const { id, resourceId, mock } = await usersWithCallbacks([
			{ on: "create", target: toTunnel("/hooks/users") },
		]);
		await mock
			.call("post", "/users", { name: "Loop" })
			.set("x-localman-hop", "1");
		await generate(OWNER, id, resourceId, 2);
		await outbound.queue().drain();
		expect(outbound.received).toHaveLength(0);
		expect(await OutboundJobModel.countDocuments()).toBe(0);
	});

	it("lets collaborators read callbacks but not change or test them", async () => {
		const COLLAB = "acc_callback_collab";
		const { id, path } = await usersWithCallbacks([
			{ on: "update", target: toTunnel("/hooks/users") },
		]);
		await UserModel.create({ sub: COLLAB, username: "collab" });
		await CollaboratorModel.create({
			projectId: new Types.ObjectId(id),
			inviteeUserId: COLLAB,
			status: "accepted",
			invitedBy: OWNER,
		});
		const read = await as(COLLAB).get(path);
		expect(read.status).toBe(200);
		expect(read.body).toMatchObject({ canManage: false, max: 10 });
		expect(read.body.callbacks[0]).toMatchObject({
			on: "update",
			targetLabel: "tunnel:3000/hooks/users",
			enabled: true,
		});
		const put = await as(COLLAB).send("put", path, { callbacks: [] });
		expect(put.status).toBe(403);
		const test = await as(COLLAB).send("post", `${path}/test`, {
			callback: { on: "create", target: toTunnel("/hooks/users") },
		});
		expect(test.status).toBe(403);
	});
});
