import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { createResource } from "./__fixtures__/sample-operations.js";
import { defineOperation } from "./define-operation.js";
import type { AnyOperation, OperationSpec } from "./types.js";

type Spec = OperationSpec<z.ZodObject<{ name: z.ZodString }>, z.ZodType>;

function validSpec(overrides: Partial<Spec> = {}): Spec {
	return {
		id: "client.renameProject",
		method: "PATCH",
		path: "/projects/:name",
		summary: "Rename a project",
		input: z.object({ name: z.string() }),
		output: z.object({ ok: z.boolean() }),
		scopes: ["projects:write"],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "client",
		mcp: true,
		handler: () => ({ ok: true }),
		...overrides,
	};
}

describe("defineOperation", () => {
	it("infers handler input and output types from zod schemas", () => {
		const op = defineOperation({
			...validSpec(),
			input: z.object({ name: z.string(), limit: z.coerce.number() }),
			output: z.object({ total: z.number() }),
			handler: (_ctx, input) => {
				expectTypeOf(input).toEqualTypeOf<{ name: string; limit: number }>();
				return { total: input.limit };
			},
		});
		expectTypeOf(op.handler).returns.toEqualTypeOf<
			{ total: number } | Promise<{ total: number }>
		>();
		expectTypeOf(op).toExtend<AnyOperation>();
	});

	it("normalises defaults and freezes the definition", () => {
		const op = defineOperation(validSpec());
		expect(op.dryRun).toBe(false);
		expect(op.successStatus).toBe(200);
		expect(Object.isFrozen(op)).toBe(true);
		expect(createResource.successStatus).toBe(201);
	});

	it("rejects an exempt MCP declaration without a reason", () => {
		expect(() =>
			defineOperation(validSpec({ mcp: { exempt: "   " } })),
		).toThrow(/must explain why there is no MCP tool/);
	});

	it("rejects a destructive operation without dry run", () => {
		const annotations = {
			readOnly: false,
			destructive: true,
			idempotent: true,
		};
		expect(() => defineOperation(validSpec({ annotations }))).toThrow(
			/destructive operations must set `dryRun: true`/,
		);
		expect(() =>
			defineOperation(validSpec({ annotations, dryRun: true })),
		).not.toThrow();
	});

	it("rejects a missing mcp field coming from untyped code", () => {
		const { mcp: _mcp, ...rest } = validSpec();
		expect(() => defineOperation(rest as Spec)).toThrow(/declare `mcp: true`/);
	});

	it("requires a description for an MCP tool", () => {
		expect(() => defineOperation(validSpec({ summary: undefined }))).toThrow(
			/needs a summary or description/,
		);
	});

	it.each([
		["Client.rename", /toolset\.verbNoun/],
		["client.getURL", /toolset\.verbNoun/],
		["client_rename", /toolset\.verbNoun/],
		["mock.renameProject", /prefix must equal toolset "client"/],
	])("rejects malformed id %s", (id, message) => {
		expect(() => defineOperation(validSpec({ id }))).toThrow(message);
	});

	it("rejects bad paths, missing path params and bad scopes", () => {
		expect(() =>
			defineOperation(validSpec({ path: "/projects/*rest" })),
		).toThrow(/static segments/);
		expect(() => defineOperation(validSpec({ path: "/projects/:id" }))).toThrow(
			/":id" is missing from `input`/,
		);
		expect(() => defineOperation(validSpec({ scopes: ["a b"] }))).toThrow(
			/non-empty scope names/,
		);
		expect(() => defineOperation(validSpec({ scopes: ["a", "a"] }))).toThrow(
			/duplicates/,
		);
	});

	it("rejects a state-changing GET and a public destructive operation", () => {
		expect(() =>
			defineOperation(validSpec({ method: "GET", path: "/projects/:name" })),
		).toThrow(/GET operation must be readOnly/);
		expect(() =>
			defineOperation(
				validSpec({
					annotations: { readOnly: false, destructive: true, idempotent: true },
					dryRun: true,
					scopes: [],
				}),
			),
		).toThrow(/destructive operation cannot be public/);
	});

	it("rejects contradictory annotations and unrepresentable inputs", () => {
		expect(() =>
			defineOperation(
				validSpec({
					annotations: { readOnly: true, destructive: true, idempotent: true },
					dryRun: true,
				}),
			),
		).toThrow(/both readOnly and destructive/);
		expect(() =>
			defineOperation({
				...validSpec(),
				input: z.object({ name: z.string(), at: z.date() }),
			}),
		).toThrow(/no JSON Schema form/);
	});
});
