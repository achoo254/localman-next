import { describe, expect, it } from "vitest";
import { MAX_OPENAPI_BYTES } from "./openapi-document.js";
import { MAX_INFERENCE_WARNINGS } from "./schema-inference-context.js";
import { MAX_COMPONENTS_TRIED } from "./schema-inference-openapi.js";
import { inferSchema } from "./schema-inference.js";

const USER = { properties: { name: { type: "string" } } };

/** An OpenAPI document of `schemas` padded with `filler` JSON numbers. */
function documentText(schemas: Record<string, object>, filler = 0): string {
	return JSON.stringify({
		openapi: "3.0.0",
		info: { title: "big", version: "1" },
		paths: {},
		"x-filler": Array.from({ length: filler }, (_, i) => i),
		components: { schemas },
	});
}

function timed<T>(run: () => T): { value: T; ms: number } {
	const started = performance.now();
	const value = run();
	return { value, ms: performance.now() - started };
}

describe("OpenAPI import of a large document", () => {
	it("reads a 2 MB document with thousands of components quickly", () => {
		const schemas: Record<string, object> = { User: USER };
		for (let i = 0; i < 20_000; i += 1) schemas[`S${i}`] = { type: "string" };
		const text = documentText(schemas, 100_000);
		expect(text.length).toBeGreaterThan(1_000_000);
		expect(text.length).toBeLessThan(MAX_OPENAPI_BYTES);

		const { value: result, ms } = timed(() =>
			inferSchema(text, { format: "openapi" }),
		);
		expect(ms).toBeLessThan(1_000);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.resources.map((resource) => resource.name)).toEqual(["User"]);
		// One SKIPPED per component tried after User, then TOO_MANY_RESOURCES;
		// past the warning cap they are only counted.
		const more = result.warnings.find((w) => w.code === "MORE_WARNINGS");
		expect(more?.params.count).toBe(
			MAX_COMPONENTS_TRIED - MAX_INFERENCE_WARNINGS,
		);
	});

	it("stops at the resource cap with a warning", () => {
		const schemas: Record<string, object> = { User: USER };
		for (let i = 0; i < 60; i += 1) schemas[`S${i}`] = { type: "string" };
		for (let i = 0; i < 300; i += 1) schemas[`R${i}`] = USER;
		const result = inferSchema(documentText(schemas), { format: "auto" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.resources).toHaveLength(50);
		expect(result.warnings.map((w) => w.code)).toContain("TOO_MANY_RESOURCES");
	});

	it("shares one step budget between the components of an import", () => {
		// Each A walks B's 9 000 properties: fine alone, too much 16 times.
		const big: Record<string, object> = {};
		for (let i = 0; i < 9_000; i += 1) big[`p${i}`] = {};
		const schemas: Record<string, object> = { B: { properties: big } };
		for (let i = 0; i < 16; i += 1) {
			schemas[`A${i}`] = { allOf: [{ $ref: "#/components/schemas/B" }] };
		}
		const { value: result, ms } = timed(() =>
			inferSchema(documentText(schemas), { format: "openapi" }),
		);
		expect(result.ok ? "ok" : result.error.code).toBe("TOO_COMPLEX");
		expect(ms).toBeLessThan(500);
	});
});
