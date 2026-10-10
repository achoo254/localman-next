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
import { createResource } from "../resources/testing/resource-fixture.js";
import { UserModel } from "../users/user-model.js";
import { HIDDEN_HEADER_VALUE, keepHiddenValues } from "./callback-headers.js";
import { CallbackConfigModel } from "./callback-model.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();
const COLLAB = "acc_callback_secret_collab";

const toTunnel = (path: string) => ({ kind: "tunnel", port: 3000, path });
const SECRET_HEADERS = [
	{ name: "X-Hook-Secret", value: "whsec_1" },
	{ name: "X-Trace", value: "t-1" },
];

async function usersWithSecret() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	const path = `/projects/${project.id}/resources/${users.id}/callbacks`;
	const set = await as(OWNER).send("put", path, {
		callbacks: [
			{
				id: "cb1",
				on: "create",
				target: toTunnel("/hooks/users"),
				headers: SECRET_HEADERS,
			},
		],
	});
	expect(set.status, JSON.stringify(set.body)).toBe(200);
	return { ...project, path, resourceId: users.id };
}

async function addCollaborator(projectId: string): Promise<void> {
	await UserModel.create({ sub: COLLAB, username: "collab" });
	await CollaboratorModel.create({
		projectId: new Types.ObjectId(projectId),
		inviteeUserId: COLLAB,
		status: "accepted",
		invitedBy: OWNER,
	});
}

describe("callback header values", () => {
	it("are shown to the owner and hidden from collaborators", async () => {
		const { id, path } = await usersWithSecret();
		await addCollaborator(id);
		const owner = await as(OWNER).get(path);
		expect(owner.body.callbacks[0].headers).toEqual([
			{ name: "X-Hook-Secret", value: "whsec_1", hidden: false },
			{ name: "X-Trace", value: "t-1", hidden: false },
		]);
		const member = await as(COLLAB).get(path);
		expect(member.status).toBe(200);
		expect(member.body.callbacks[0].headers).toEqual([
			{ name: "X-Hook-Secret", value: HIDDEN_HEADER_VALUE, hidden: true },
			{ name: "X-Trace", value: HIDDEN_HEADER_VALUE, hidden: true },
		]);
		// The body template is not a secret.
		expect(member.body.callbacks[0].bodyTemplate).toBe(
			owner.body.callbacks[0].bodyTemplate,
		);
	});

	it("keep the stored value when sent back as [hidden]", async () => {
		const { path, resourceId } = await usersWithSecret();
		const put = await as(OWNER).send("put", path, {
			callbacks: [
				{
					id: "cb1",
					on: "create",
					target: toTunnel("/hooks/users"),
					headers: [
						{ name: "x-hook-secret", value: HIDDEN_HEADER_VALUE },
						{ name: "X-Trace", value: "t-2" },
						{ name: "X-New", value: HIDDEN_HEADER_VALUE },
					],
				},
			],
		});
		expect(put.status, JSON.stringify(put.body)).toBe(200);
		const stored = await CallbackConfigModel.findOne({
			resourceId: new Types.ObjectId(resourceId),
		}).lean();
		expect(stored?.callbacks[0]?.headers).toEqual([
			{ name: "x-hook-secret", value: "whsec_1" },
			{ name: "X-Trace", value: "t-2" },
			// No stored header of that name: kept as typed.
			{ name: "X-New", value: HIDDEN_HEADER_VALUE },
		]);

		// A new callback (no id) has nothing to keep.
		await as(OWNER).send("put", path, {
			callbacks: [
				{
					on: "create",
					target: toTunnel("/hooks/users"),
					headers: [{ name: "X-Hook-Secret", value: HIDDEN_HEADER_VALUE }],
				},
			],
		});
		const replaced = await as(OWNER).get(path);
		expect(replaced.body.callbacks[0].headers[0].value).toBe(
			HIDDEN_HEADER_VALUE,
		);
	});

	it("match same-named headers in order", () => {
		const stored = [
			{ name: "X-Sig", value: "a" },
			{ name: "X-Sig", value: "b" },
		];
		const sent = [
			{ name: "X-Sig", value: "x" },
			{ name: "X-Sig", value: HIDDEN_HEADER_VALUE },
		];
		expect(keepHiddenValues(sent, stored)).toEqual([
			{ name: "X-Sig", value: "x" },
			{ name: "X-Sig", value: "b" },
		]);
	});

	it("are masked in the callback's log line", async () => {
		outbound.answer("/hooks/users", 200);
		const { secret } = await usersWithSecret();
		await kit.client(secret).call("post", "/users", { name: "Ada" });
		await outbound.queue().drain();
		expect(outbound.received[0]?.headers["x-hook-secret"]).toBe("whsec_1");

		await requestLog.flush();
		const [line] = await RequestLogModel.find({ source: "callback" }).lean<
			StoredRequestLog[]
		>();
		const sent = new Map(
			line?.request.headers.map(({ name, value }) => [name, value]),
		);
		expect(sent.get("X-Hook-Secret")).toBe("[redacted]");
		expect(sent.get("X-Trace")).toBe("[redacted]");
		expect(sent.get("Content-Type")).toBe("application/json");
		expect(sent.get("X-Localman-Hop")).toBe("1");
	});
});
