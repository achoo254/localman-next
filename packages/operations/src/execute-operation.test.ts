import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineOperation } from "./define-operation.js";
import { executeOperation } from "./execute-operation.js";
import { OperationError } from "./operation-error.js";

const steps: string[] = [];

const renameProject = defineOperation({
	id: "client.renameProject",
	method: "PUT",
	path: "/projects/:projectId",
	summary: "Rename a project",
	input: z.object({ projectId: z.string(), name: z.string().default("x") }),
	output: z.object({ name: z.string(), dryRun: z.boolean() }),
	scopes: ["user"],
	guard: (ctx) => {
		steps.push("guard");
		return ctx.auth?.subjectId !== "banned";
	},
	policy: (_ctx, input) => {
		steps.push("policy");
		return input.projectId !== "theirs";
	},
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: (ctx, input) => {
		steps.push("handler");
		return { name: input.name, dryRun: ctx.dryRun };
	},
});

function call(subjectId: string, input: unknown) {
	steps.length = 0;
	const beforeHandler = vi.fn(() => {
		steps.push("beforeHandler");
	});
	const run = executeOperation(renameProject, {
		auth: { subjectId, scopes: ["user"] },
		clientIp: null,
		readRequest: () => {
			steps.push("readRequest");
			return { dryRun: true, input };
		},
		beforeHandler,
	});
	return { run, beforeHandler };
}

describe("executeOperation", () => {
	it("runs guard, input, policy, beforeHandler and handler in order", async () => {
		const { run, beforeHandler } = call("u1", { projectId: "p1" });
		const result = await run;
		expect(steps).toEqual([
			"guard",
			"readRequest",
			"policy",
			"beforeHandler",
			"handler",
		]);
		expect(result.input).toEqual({ projectId: "p1", name: "x" });
		expect(result.output).toEqual({ name: "x", dryRun: true });
		expect(result.ctx.dryRun).toBe(true);
		expect(beforeHandler).toHaveBeenCalledWith(result.ctx, result.input);
	});

	it("refuses a guarded caller before reading the request", async () => {
		const { run } = call("banned", { projectId: "p1" });
		await expect(run).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
		expect(steps).toEqual(["guard"]);
	});

	it("stops at validation and policy before beforeHandler", async () => {
		const invalid = call("u1", { projectId: 1 });
		await expect(invalid.run).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
		});
		expect(invalid.beforeHandler).not.toHaveBeenCalled();

		const refused = call("u1", { projectId: "theirs" });
		await expect(refused.run).rejects.toBeInstanceOf(OperationError);
		expect(refused.beforeHandler).not.toHaveBeenCalled();
	});

	it("requires the operation scopes", async () => {
		await expect(
			executeOperation(renameProject, {
				auth: null,
				clientIp: null,
				readRequest: () => ({ dryRun: false, input: {} }),
			}),
		).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
	});
});
