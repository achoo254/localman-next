import express, {
	type ErrorRequestHandler,
	type Express,
	type Request,
} from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	createResource,
	deleteProject,
	getResource,
} from "./__fixtures__/sample-operations.js";
import { defineOperation } from "./define-operation.js";
import { OperationError } from "./operation-error.js";
import { createOperationRouter } from "./operation-router.js";
import type { AnyOperation, AuthContext } from "./types.js";

const ownerOnly = defineOperation({
	id: "client.getSecret",
	method: "GET",
	path: "/secrets/:ownerId",
	summary: "Read a secret of its owner",
	input: z.object({ ownerId: z.string() }),
	output: z.object({ secret: z.string() }),
	scopes: [],
	policy: (ctx, input) => ctx.auth?.subjectId === input.ownerId,
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: () => ({ secret: "s3cret" }),
});

const brokenOutput = defineOperation({
	id: "client.getBroken",
	method: "GET",
	path: "/broken",
	summary: "Returns data violating its own schema",
	input: z.object({}),
	output: z.object({ count: z.number() }),
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	// Simulates a handler bug that slipped past the type checker.
	handler: () => JSON.parse('{"count":"many"}') as { count: number },
});

/** Minimal stand-in for the app error handler: formats known errors only. */
const testErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	if (err instanceof OperationError) {
		res.status(err.status).json(err.toBody());
		return;
	}
	res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "boom" } });
};

function resolveAuthFromHeader(req: Request): AuthContext | null {
	const header = req.get("x-test-scopes");
	if (header === undefined) return null;
	return {
		subjectId: req.get("x-test-subject") ?? "u1",
		scopes: header.split(","),
	};
}

function createApp(operations: readonly AnyOperation[]): Express {
	const app = express();
	app.use(express.json());
	app.use(
		createOperationRouter(operations, { resolveAuth: resolveAuthFromHeader }),
	);
	app.use(testErrorHandler);
	return app;
}

const app = createApp([
	getResource,
	createResource,
	deleteProject,
	ownerOnly,
	brokenOutput,
]);

describe("createOperationRouter", () => {
	it("returns validated output for valid input", async () => {
		const res = await request(app)
			.get("/projects/p1/resources/r1?expand=schema")
			.set("x-test-scopes", "mock:read");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ id: "r1", projectId: "p1", name: "users" });
	});

	it("merges params with body, applies defaults and uses successStatus", async () => {
		const res = await request(app)
			.post("/projects/p1/resources")
			.set("x-test-scopes", "mock:write")
			.send({ name: "posts", projectId: "attacker" });
		expect(res.status).toBe(201);
		expect(res.body).toEqual({ id: "res_1", name: "posts", count: 10 });
	});

	it("rejects invalid input with VALIDATION_ERROR", async () => {
		const res = await request(app)
			.post("/projects/p1/resources")
			.set("x-test-scopes", "mock:write")
			.send({ name: "", count: 500 });
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
		expect(res.body.error.message).toMatch(/Invalid input at "name"/);
		expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
			["name", "count"],
		);
	});

	it("rejects a non-object JSON body", async () => {
		const res = await request(app)
			.post("/projects/p1/resources")
			.set("x-test-scopes", "mock:write")
			.send([1, 2]);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("returns 401 when a scoped operation has no auth", async () => {
		const res = await request(app).get("/projects/p1/resources/r1");
		expect(res.status).toBe(401);
		expect(res.body).toEqual({
			error: { code: "UNAUTHENTICATED", message: "Authentication required" },
		});
	});

	it("returns 403 when a scope is missing", async () => {
		const res = await request(app)
			.get("/projects/p1/resources/r1")
			.set("x-test-scopes", "mock:write");
		expect(res.status).toBe(403);
		expect(res.body.error).toEqual({
			code: "FORBIDDEN",
			message: "Missing required scope: mock:read",
		});
	});

	it("returns 403 when the policy denies", async () => {
		const denied = await request(app)
			.get("/secrets/u2")
			.set("x-test-scopes", "")
			.set("x-test-subject", "u1");
		expect(denied.status).toBe(403);
		expect(denied.body.error.code).toBe("FORBIDDEN");

		const allowed = await request(app)
			.get("/secrets/u1")
			.set("x-test-scopes", "")
			.set("x-test-subject", "u1");
		expect(allowed.status).toBe(200);
	});

	it("returns 500 when the handler output violates the schema", async () => {
		const res = await request(app).get("/broken");
		expect(res.status).toBe(500);
		expect(res.body.error.code).toBe("INTERNAL_ERROR");
	});

	it("passes the dry-run flag to dry-run operations", async () => {
		const preview = await request(app)
			.delete("/projects/p1?dryRun=true")
			.set("x-test-scopes", "projects:write");
		expect(preview.status).toBe(200);
		expect(preview.body).toEqual({ deleted: false, dryRun: true });

		const real = await request(app)
			.delete("/projects/p1")
			.set("x-test-scopes", "projects:write");
		expect(real.body).toEqual({ deleted: true, dryRun: false });

		const bad = await request(app)
			.delete("/projects/p1?dryRun=maybe")
			.set("x-test-scopes", "projects:write");
		expect(bad.status).toBe(400);
	});

	it("forwards resolveAuth failures to the error handler", async () => {
		const failing = express();
		failing.use(
			createOperationRouter([getResource], {
				resolveAuth: async () => {
					throw new Error("session store down");
				},
			}),
		);
		failing.use(testErrorHandler);
		const res = await request(failing).get("/projects/p1/resources/r1");
		expect(res.status).toBe(500);
	});
	it("rejects a non-JSON body on a mutating route with 415", async () => {
		const res = await request(app)
			.post("/projects/p1/resources?name=evil")
			.set("x-test-scopes", "mock:write")
			.set("content-type", "text/plain")
			.send("name=evil");
		expect(res.status).toBe(415);
		expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
	});

	it("ignores query values as input for non-GET methods", async () => {
		const res = await request(app)
			.post("/projects/p1/resources?name=evil")
			.set("x-test-scopes", "mock:write");
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("refuses dryRun on an operation that cannot preview", async () => {
		const res = await request(app)
			.post("/projects/p1/resources?dryRun=true")
			.set("x-test-scopes", "mock:write")
			.send({ name: "posts" });
		expect(res.status).toBe(400);
		expect(res.body.error.message).toMatch(/does not support "dryRun"/);
	});

	it("coerces number and boolean query values for GET", async () => {
		const listItems = defineOperation({
			id: "client.listItems",
			method: "GET",
			path: "/items",
			summary: "List items",
			input: z.object({ limit: z.number().int(), archived: z.boolean() }),
			output: z.object({ limit: z.number(), archived: z.boolean() }),
			scopes: [],
			annotations: { readOnly: true, destructive: false, idempotent: true },
			toolset: "client",
			mcp: true,
			handler: (_ctx, input) => input,
		});
		const res = await request(createApp([listItems])).get(
			"/items?limit=5&archived=false",
		);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ limit: 5, archived: false });

		const bad = await request(createApp([listItems])).get(
			"/items?limit=five&archived=false",
		);
		expect(bad.status).toBe(400);
	});

	it("runs the guard before parsing input or the dryRun flag", async () => {
		const ownersOnly = defineOperation({
			id: "admin.deleteThing",
			method: "DELETE",
			path: "/things/:thingId",
			summary: "Delete a thing (owners only)",
			input: z.object({ thingId: z.string().regex(/^\d+$/) }),
			output: z.object({ ok: z.boolean() }),
			scopes: ["user"],
			guard: (ctx) => ctx.auth?.subjectId === "owner",
			annotations: { readOnly: false, destructive: true, idempotent: true },
			toolset: "admin",
			mcp: true,
			dryRun: true,
			handler: () => ({ ok: true }),
		});
		const guarded = createApp([ownersOnly]);
		for (const path of ["/things/abc", "/things/1?dryRun=maybe", "/things/1"]) {
			const res = await request(guarded)
				.delete(path)
				.set("x-test-scopes", "user")
				.set("x-test-subject", "intruder");
			expect(res.status).toBe(403);
			expect(res.body.error.code).toBe("FORBIDDEN");
		}
		const owner = await request(guarded)
			.delete("/things/abc")
			.set("x-test-scopes", "user")
			.set("x-test-subject", "owner");
		expect(owner.status).toBe(400);
	});

	it("passes the client address resolved by trust proxy to the context", async () => {
		const whoAmI = defineOperation({
			id: "client.getCallerAddress",
			method: "GET",
			path: "/caller",
			summary: "Echo the caller address",
			input: z.object({}),
			output: z.object({ clientIp: z.string().nullable() }),
			scopes: [],
			annotations: { readOnly: true, destructive: false, idempotent: true },
			toolset: "client",
			mcp: true,
			handler: (ctx) => ({ clientIp: ctx.clientIp }),
		});
		const direct = createApp([whoAmI]);
		const untrusted = await request(direct)
			.get("/caller")
			.set("x-forwarded-for", "203.0.113.9");
		// No trusted proxy: a forged header must not change the address.
		expect(untrusted.body.clientIp).toMatch(/127\.0\.0\.1|::1/);

		const proxied = createApp([whoAmI]);
		proxied.set("trust proxy", "loopback");
		const forwarded = await request(proxied)
			.get("/caller")
			.set("x-forwarded-for", "203.0.113.9");
		expect(forwarded.body.clientIp).toBe("203.0.113.9");
	});

	it("refuses to build a router with duplicate routes", () => {
		const twin = { ...getResource, id: "client.getResource" };
		expect(() =>
			createOperationRouter([getResource, twin], {
				resolveAuth: () => null,
			}),
		).toThrow(/DUPLICATE_ROUTE/);
	});
});
