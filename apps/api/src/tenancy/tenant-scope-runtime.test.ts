import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../logger.js";
import { readUsage } from "../modules/billing/usage-counter-model.js";
import type { RequestLogInput } from "../modules/mock-runtime/request-log-entry.js";
import { RequestLogModel } from "../modules/mock-runtime/request-log-model.js";
import { RequestLogService } from "../modules/mock-runtime/request-log-service.js";
import { UsageMeter } from "../modules/mock-runtime/usage-meter.js";
import { ProjectModel } from "../modules/projects/project-model.js";
import { as, useDashboardTestDb } from "../test-support/dashboard-test-app.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import {
	type LocalmanTenant,
	MissingTenantError,
	acrossTenants,
	runInTenant,
	setTestDefaultTenant,
} from "./tenant-context.js";

// No default tenant here: what works below sets its tenant itself, as in
// production.
useDashboardTestDb();
beforeAll(() => setTestDefaultTenant(undefined));
afterAll(() => setTestDefaultTenant(TEST_TENANT));

const OTHER: LocalmanTenant = { ...TEST_TENANT, id: "ten_AAAAAAAAAAAAAAAA" };
const logger = createLogger("silent");

function logInput(projectId: Types.ObjectId): RequestLogInput {
	const body = { bytes: Buffer.from("{}"), size: 2 };
	return {
		projectId,
		ownerPlan: { plan: "free", planExpiresAt: null },
		redactHeaders: [],
		at: new Date(),
		method: "GET",
		path: "/users",
		query: "",
		status: 200,
		ms: 1,
		source: "mock",
		request: { headers: [], body },
		response: { headers: [], body },
	};
}

describe("tenant scope without a default tenant", () => {
	it("refuses a model call outside any tenant", async () => {
		await expect(ProjectModel.countDocuments().exec()).rejects.toBeInstanceOf(
			MissingTenantError,
		);
	});

	it("serves a signed-in request in the tenant of its host", async () => {
		const response = await as("alice").get("/projects");
		expect(response.status).toBe(200);
	});

	it("flushes usage counted in a request into that request's tenant", async () => {
		const meter = new UsageMeter({ logger, warn: async () => undefined });
		await runInTenant(OTHER, () => meter.admit("owner", null));
		await meter.flush();
		const counted = (tenant: LocalmanTenant) =>
			runInTenant(tenant, () => readUsage("owner"));
		expect((await counted(OTHER)).mockRequests).toBe(1);
		expect((await counted(TEST_TENANT)).mockRequests).toBe(0);
	});

	it("writes request log lines in the tenant they were recorded in", async () => {
		const log = new RequestLogService();
		log.configure(logger);
		const projectId = new Types.ObjectId();
		runInTenant(OTHER, () => log.record(logInput(projectId)));
		runInTenant(TEST_TENANT, () => log.record(logInput(projectId)));
		await log.flush();
		const tenants = await acrossTenants(() =>
			RequestLogModel.find({ projectId }).lean().exec(),
		);
		expect(tenants.map((line) => Reflect.get(line, "tenantId")).sort()).toEqual(
			[OTHER.id, TEST_TENANT.id].sort(),
		);
	});
});
