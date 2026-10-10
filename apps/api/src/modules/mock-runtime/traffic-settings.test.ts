import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ClientSettingsModel } from "../api-client/client-settings-model.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { UserModel } from "../users/user-model.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { ownerTunnelUrl } from "./upstream-target.js";

useMockTestKit({ settings: () => ({ tunnelDomains: ["tunnel.test"] }) });

const COLLAB = "acc_traffic_collab";
const STRANGER = "acc_traffic_stranger";

async function projectWithCollaborator(): Promise<string> {
	const { id } = await createMockProject();
	await UserModel.create([
		{ sub: COLLAB, username: "collab" },
		{ sub: STRANGER, username: "stranger" },
	]);
	await CollaboratorModel.create({
		projectId: new Types.ObjectId(id),
		inviteeUserId: COLLAB,
		status: "accepted",
		invitedBy: OWNER,
	});
	return id;
}

const upstreamPath = (id: string) => `/projects/${id}/upstream`;

describe("traffic settings", () => {
	it("lets only the owner set the upstream; members read it", async () => {
		const id = await projectWithCollaborator();
		const tunnel = { upstream: { kind: "tunnel", port: 3000 } };
		const denied = await as(COLLAB).send("put", upstreamPath(id), tunnel);
		expect(denied.status).toBe(403);
		const hidden = await as(STRANGER).send("put", upstreamPath(id), tunnel);
		expect(hidden.status).toBe(404);

		const set = await as(OWNER).send("put", upstreamPath(id), tunnel);
		expect(set.status, JSON.stringify(set.body)).toBe(200);
		expect(set.body).toMatchObject({
			upstream: { kind: "tunnel", port: 3000 },
			tunnelUrl: null,
			plan: "free",
			logDays: 7,
			canManage: true,
		});
		const read = await as(COLLAB).get(`/projects/${id}/traffic-settings`);
		expect(read.status).toBe(200);
		expect(read.body).toMatchObject({
			upstream: { kind: "tunnel", port: 3000 },
			canManage: false,
		});
		const off = await as(OWNER).send("put", upstreamPath(id), {
			upstream: { kind: "none" },
		});
		expect(off.body.upstream).toEqual({ kind: "none" });
	});

	it("accepts only public https base URLs", async () => {
		const { id } = await createMockProject();
		const put = (baseUrl: string) =>
			as(OWNER).send("put", upstreamPath(id), {
				upstream: { kind: "url", baseUrl },
			});
		for (const bad of [
			"http://staging.example.com",
			"https://user:pw@staging.example.com",
			"https://staging.example.com/?a=1",
			"https://abc.localman.test",
		]) {
			const res = await put(bad);
			expect(res.status, bad).toBe(400);
			expect(res.body.error.code, bad).toBe("VALIDATION_ERROR");
		}
		for (const privateUrl of ["https://10.0.0.1", "https://[::1]:8443/api"]) {
			const res = await put(privateUrl);
			expect(res.status, privateUrl).toBe(400);
			expect(res.body.error.code, privateUrl).toBe("UPSTREAM_URL_BLOCKED");
		}
		const ok = await put("https://93.184.215.14:8443/api/");
		expect(ok.status, JSON.stringify(ok.body)).toBe(200);
		expect(ok.body.upstream).toEqual({
			kind: "url",
			baseUrl: "https://93.184.215.14:8443/api",
		});
	});

	it("stores the extra masked headers lowercase, owner only", async () => {
		const id = await projectWithCollaborator();
		const path = `/projects/${id}/redact-headers`;
		const headers = { headers: ["X-Secret", "x-secret", "X-Token"] };
		expect((await as(COLLAB).send("put", path, headers)).status).toBe(403);
		const res = await as(OWNER).send("put", path, headers);
		expect(res.status).toBe(200);
		expect(res.body.redactHeaders).toEqual(["x-secret", "x-token"]);
		expect(res.body.defaultRedactedHeaders).toContain("authorization");
		const bad = await as(OWNER).send("put", path, { headers: ["bad name"] });
		expect(bad.status).toBe(400);
	});

	it("finds the owner's enabled tunnel mapping on a tunnel domain", async () => {
		await ClientSettingsModel.create({
			userSub: OWNER,
			tunnelMappings: [
				{ key: "localhost:3000", url: "https://app.tunnel.test" },
				{ key: "localhost:4000", url: "https://b.tunnel.test", enabled: false },
				{ key: "localhost:5000", url: "https://c.elsewhere.test" },
			],
		});
		expect(await ownerTunnelUrl(OWNER, 3000)).toBe("https://app.tunnel.test");
		expect(await ownerTunnelUrl(OWNER, 4000)).toBeNull();
		expect(await ownerTunnelUrl(OWNER, 5000)).toBeNull();
		expect(await ownerTunnelUrl("acc_other", 3000)).toBeNull();
	});
});
