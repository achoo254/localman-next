import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { readUsage } from "../billing/usage-counter-model.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { useOutboundTestKit } from "../mock-callbacks/testing/outbound-test-kit.js";
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
import { UserModel } from "../users/user-model.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();
const COLLAB = "acc_inbox_collab";

const inboxes = (id: string, suffix = "") => `/projects/${id}/inboxes${suffix}`;

async function inboxLines(): Promise<StoredRequestLog[]> {
	await requestLog.flush();
	return RequestLogModel.find({ source: "inbox" })
		.sort({ _id: 1 })
		.lean<StoredRequestLog[]>();
}

/** A project with inbox `stripe` forwarding to the owner's `port`. */
async function forwardingInbox(port: number, path = "/hooks/stripe") {
	const project = await createMockProject();
	const created = await as(OWNER).send("post", inboxes(project.id), {
		name: "stripe",
		response: { status: 202, contentType: "text/plain", body: "thanks" },
	});
	expect(created.status, JSON.stringify(created.body)).toBe(201);
	const forward = await as(OWNER).send(
		"put",
		inboxes(project.id, "/stripe/forward"),
		{ forward: { port, path } },
	);
	expect(forward.status, JSON.stringify(forward.body)).toBe(200);
	return { ...project, mock: kit.client(project.secret) };
}

describe("webhook inbox", () => {
	it("answers the custom response, logs masked and forwards to the tunnel", async () => {
		outbound.answer("/hooks/stripe", 200);
		const { id, secret, mock } = await forwardingInbox(3000);
		const res = await mock
			.call("post", "/_inbox/stripe?attempt=1")
			.set("authorization", "Bearer sk_live")
			.set("stripe-signature", "t=1,v1=abc")
			.set("content-type", "application/json")
			.send('{"type":"charge.succeeded"}');
		expect(res.status).toBe(202);
		expect(res.headers["content-type"]).toContain("text/plain");
		expect(res.headers["x-localman-source"]).toBe("inbox");
		expect(res.text).toBe("thanks");

		await outbound.queue().drain();
		expect(outbound.received).toHaveLength(1);
		const [sent] = outbound.received;
		expect(sent).toMatchObject({
			method: "POST",
			url: "/hooks/stripe?attempt=1",
			body: '{"type":"charge.succeeded"}',
		});
		expect(sent?.headers.authorization).toBe("Bearer sk_live");
		expect(sent?.headers["stripe-signature"]).toBe("t=1,v1=abc");
		expect(sent?.headers["x-localman-proxy"]).toBe("1");
		expect(sent?.headers["x-localman-hop"]).toBe("1");

		const [line] = await inboxLines();
		expect(line).toMatchObject({
			method: "POST",
			path: "/_inbox/stripe",
			status: 202,
			inbox: "stripe",
			target: "tunnel:3000/hooks/stripe",
			attempts: [expect.objectContaining({ status: 200 })],
		});
		const auth = line?.request.headers.find((h) => h.name === "authorization");
		expect(auth?.value).toBe("[redacted]");

		const list = await as(OWNER).get(inboxes(id));
		expect(list.body).toMatchObject({ used: 1, max: 2, canManage: true });
		expect(list.body.items[0]).toMatchObject({
			name: "stripe",
			url: `https://${secret}.localman.test/_inbox/stripe`,
			forward: { port: 3000, path: "/hooks/stripe" },
			lastForward: { ok: true, status: 200 },
			requestCount: 1,
		});
	});

	it("tries a failing tunnel exactly 3 times with backoff", async () => {
		outbound.answer("/hooks/stripe", 503);
		const { mock } = await forwardingInbox(3000);
		await mock.call("post", "/_inbox/stripe").send({ id: "evt_1" });
		await outbound.queue().drain();
		expect(outbound.received).toHaveLength(3);
		const [first, second, third] = outbound.received.map((r) => r.at);
		expect((second ?? 0) - (first ?? 0)).toBeGreaterThanOrEqual(25);
		expect((third ?? 0) - (second ?? 0)).toBeGreaterThanOrEqual(85);
		const [line] = await inboxLines();
		expect(line?.attempts?.map((a) => a.status)).toEqual([503, 503, 503]);

		const down = await forwardingInbox(5000);
		await down.mock.call("post", "/_inbox/stripe").send({ id: "evt_2" });
		await outbound.queue().drain();
		const lines = await inboxLines();
		expect(lines.at(-1)?.attempts?.map((a) => a.error)).toEqual([
			"connect",
			"connect",
			"connect",
		]);
	});

	it("does not forward a request that came back through a tunnel", async () => {
		outbound.answer("/hooks/stripe", 200);
		const { mock } = await forwardingInbox(3000);
		const res = await mock
			.call("post", "/_inbox/stripe")
			.set("x-localman-hop", "1")
			.send({ id: "evt_3" });
		expect(res.status).toBe(202);
		await outbound.queue().drain();
		expect(outbound.received).toHaveLength(0);
		const [line] = await inboxLines();
		expect(line?.target).toBeUndefined();
	});

	it("answers 404 for an unknown inbox and 413 past 100 KB, counting both", async () => {
		const { id, secret } = await createMockProject();
		await as(OWNER).send("post", inboxes(id), { name: "github" });
		const mock = kit.client(secret);
		const missing = await mock.call("post", "/_inbox/nope").send({});
		expect(missing.status).toBe(404);
		expect(missing.body).toEqual({
			error: { code: "NOT_FOUND", message: "Inbox not found" },
		});
		const big = await mock
			.call("post", "/_inbox/github")
			.set("content-type", "text/plain")
			.send("x".repeat(101 * 1024));
		expect(big.status).toBe(413);
		const ok = await mock.get("/_inbox/github");
		expect(ok.status).toBe(200);
		expect(ok.body).toEqual({ received: true });
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(3);
	});

	it("lets collaborators read inboxes but not change them", async () => {
		const { id } = await createMockProject();
		await UserModel.create({ sub: COLLAB, username: "collab" });
		await CollaboratorModel.create({
			projectId: new Types.ObjectId(id),
			inviteeUserId: COLLAB,
			status: "accepted",
			invitedBy: OWNER,
		});
		await as(OWNER).send("post", inboxes(id), { name: "shop" });
		const read = await as(COLLAB).get(inboxes(id));
		expect(read.status).toBe(200);
		expect(read.body).toMatchObject({ used: 1, canManage: false });
		const denied = [
			await as(COLLAB).send("post", inboxes(id), { name: "mine" }),
			await as(COLLAB).send("put", inboxes(id, "/shop"), { response: {} }),
			await as(COLLAB).send("put", inboxes(id, "/shop/forward"), {
				forward: { port: 3000, path: "/x" },
			}),
			await as(COLLAB).send("delete", inboxes(id, "/shop")),
		];
		expect(denied.map((res) => res.status)).toEqual([403, 403, 403, 403]);

		const updated = await as(OWNER).send("put", inboxes(id, "/shop"), {
			response: { status: 204, body: "" },
		});
		expect(updated.body.response).toMatchObject({
			status: 204,
			contentType: "application/json",
		});
		const gone = await as(OWNER).send("delete", inboxes(id, "/shop"));
		expect(gone.body).toEqual({ dryRun: false, name: "shop" });
		expect((await as(OWNER).get(inboxes(id))).body.used).toBe(0);
	});
});
