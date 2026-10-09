import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createQueryCoercer } from "./query-coercion.js";

describe("createQueryCoercer", () => {
	const coerce = createQueryCoercer(
		z.object({ limit: z.number().optional(), on: z.boolean().optional() }),
	);

	it("converts number and boolean fields and passes the rest through", () => {
		expect(coerce({ limit: "5", on: "true", q: "x" })).toEqual({
			limit: 5,
			on: true,
			q: "x",
		});
		expect(coerce({ limit: "abc" })).toEqual({ limit: "abc" });
	});

	it("keeps a __proto__ key as data, never as the prototype", () => {
		// What `?__proto__=a&__proto__=b` parses to: an own key holding an array.
		const query: Record<string, unknown> = JSON.parse(
			'{"__proto__":["a","b"],"limit":"2"}',
		);
		const coerced = coerce(query);
		expect(Object.hasOwn(coerced, "__proto__")).toBe(true);
		expect(Object.getPrototypeOf(coerced)).toBe(Object.prototype);
		expect(coerced.limit).toBe(2);
	});
});
