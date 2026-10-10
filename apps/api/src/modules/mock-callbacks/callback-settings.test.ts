import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
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
import { createResource } from "../resources/testing/resource-fixture.js";
import { CallbackConfigModel } from "./callback-model.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();

const callbacksPath = (projectId: string, resourceId: string) =>
	`/projects/${projectId}/resources/${resourceId}/callbacks`;

const toTunnel = (path: string) => ({ kind: "tunnel", port: 3000, path });

async function callbackLines(): Promise<StoredRequestLog[]> {
	await requestLog.flush();
	return RequestLogModel.find({ source: "callback" })
		.sort({ _id: 1 })
		.lean<StoredRequestLog[]>();
}

describe("callback settings", () => {
	it("refuses private URLs when saved and when sent", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, { name: "users" });
		const path = callbacksPath(project.id, users.id);
		const save = (url: string) =>
			as(OWNER).send("put", path, {
				callbacks: [{ on: "create", target: { kind: "url", url } }],
			});
		const blocked = await save("https://10.0.0.1/hook");
		expect(blocked.status).toBe(400);
		expect(blocked.body.error.code).toBe("CALLBACK_URL_BLOCKED");
		expect((await save("http://hooks.example.com")).body.error.code).toBe(
			"VALIDATION_ERROR",
		);
		expect((await save("https://abc.localman.test/x")).status).toBe(400);

		// Stored before a guard change: refused when sent, and not retried.
		await CallbackConfigModel.create({
			projectId: new Types.ObjectId(project.id),
			resourceId: new Types.ObjectId(users.id),
			callbacks: [
				{
					id: "c1",
					on: "create",
					target: { kind: "url", url: "https://private.test/hook" },
					bodyTemplate: "{{record}}",
				},
			],
		});
		await kit.client(project.secret).call("post", "/users", { name: "Cy" });
		await outbound.queue().drain();
		const [line] = await callbackLines();
		expect(line?.attempts?.map((a) => a.error)).toEqual(["blocked"]);
		expect(line?.status).toBe(0);
	});

	it("keeps at most 10 callbacks per resource", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, { name: "users" });
		const many = Array.from({ length: 11 }, () => ({
			on: "create",
			target: toTunnel("/h"),
		}));
		const res = await as(OWNER).send(
			"put",
			callbacksPath(project.id, users.id),
			{ callbacks: many },
		);
		expect(res.status).toBe(400);
	});
});
