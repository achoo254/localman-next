import { describe, expect, it } from "vitest";
import {
	DYNAMIC_VARIABLES,
	DYNAMIC_VARIABLE_NAMES,
	isDynamicVariable,
	listDynamicVariables,
	needsFakerRunner,
	resolveDynamicVariable,
	uuidV4,
} from "./dynamic-variables.js";
import { FAKER_DYNAMIC_VARIABLES } from "./faker-dynamic-variables.js";
import { interpolate } from "./variable-interpolation.js";

const BUILT_IN = [
	"$guid",
	"$randomUUID",
	"$timestamp",
	"$isoTimestamp",
	"$randomInt",
];
const FAKER_NAMES = Object.keys(FAKER_DYNAMIC_VARIABLES);
const fakeRunner = (id: string) => `faker:${id}`;

describe("dynamic variables", () => {
	it("lists every name once, with the `$` and a description", () => {
		expect(DYNAMIC_VARIABLE_NAMES).toEqual([...BUILT_IN, ...FAKER_NAMES]);
		expect(new Set(DYNAMIC_VARIABLE_NAMES).size).toBe(
			DYNAMIC_VARIABLE_NAMES.length,
		);
		expect(listDynamicVariables()).toEqual([...DYNAMIC_VARIABLES]);
		for (const info of DYNAMIC_VARIABLES) {
			expect(info.name).toMatch(/^\$[A-Za-z0-9]+$/);
			expect(info.description).toMatch(/\S/);
		}
		expect(
			DYNAMIC_VARIABLES.find((v) => v.name === "$randomMACAddress"),
		).toEqual({ name: "$randomMACAddress", description: "Random mac address" });
	});

	it.each(FAKER_NAMES)(
		"%s runs its Faker method through the runner",
		(name) => {
			expect(isDynamicVariable(name)).toBe(true);
			expect(needsFakerRunner(name)).toBe(true);
			expect(resolveDynamicVariable(name, fakeRunner)).toBe(
				`faker:${FAKER_DYNAMIC_VARIABLES[name]}`,
			);
		},
	);

	it("keeps the built-in ones without Faker, in the expected shapes", () => {
		for (const name of BUILT_IN) {
			expect(needsFakerRunner(name)).toBe(false);
			expect(resolveDynamicVariable(name)).toMatch(/\S/);
			expect(resolveDynamicVariable(name, fakeRunner)).not.toMatch(/^faker:/);
		}
		expect(uuidV4()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(uuidV4()).not.toBe(uuidV4());
		expect(resolveDynamicVariable(" $isoTimestamp ")).toMatch(
			/^\d{4}-\d{2}-\d{2}T/,
		);
		expect(resolveDynamicVariable("$timestamp")).toMatch(/^\d{10}$/);
		const n = Number(resolveDynamicVariable("$randomInt"));
		expect(Number.isInteger(n) && n >= 0 && n <= 1000).toBe(true);
	});

	it("without a runner, uses the few stand-ins and leaves the rest", () => {
		expect(resolveDynamicVariable("$randomEmail")).toMatch(
			/^\S+@example\.com$/,
		);
		expect(resolveDynamicVariable("$randomColor")).toMatch(/^[a-z]+$/);
		expect(resolveDynamicVariable("$randomFullName")).toMatch(/^\S+ \S+$/);
		expect(resolveDynamicVariable("$randomCity")).toMatch(/\S/);
		expect(resolveDynamicVariable("$randomFirstName")).toBeNull();
		expect(resolveDynamicVariable("$randomHexColor")).toBeNull();
	});

	it("does not resolve unknown or inherited names", () => {
		for (const name of ["$nope", "toString", "constructor", "__proto__"]) {
			expect(resolveDynamicVariable(name, fakeRunner)).toBeNull();
			expect(isDynamicVariable(name)).toBe(false);
			expect(needsFakerRunner(name)).toBe(false);
		}
	});
});

describe("dynamic variables in interpolation", () => {
	it("fills Faker names when the context has a runner", () => {
		const result = interpolate("{{$randomFirstName}} {{ $randomUrl }}", {
			scopes: [],
			runFaker: fakeRunner,
		});
		expect(result.value).toBe("faker:name.firstName faker:internet.url");
		expect(result.unresolved).toEqual([]);
	});

	it("leaves Faker names as typed without one, not reported unresolved", () => {
		const result = interpolate("{{$randomFirstName}}/{{$nope}}", {
			scopes: [],
		});
		expect(result.value).toBe("{{$randomFirstName}}/{{$nope}}");
		expect(result.unresolved).toEqual(["$nope"]);
	});
});
