import { describe, expect, it } from "vitest";
import { runPre } from "./script-test-utils.js";

const scopes = {
	globals: { host: "global.example", onlyGlobal: "g" },
	collectionVariables: { host: "collection.example", onlyCollection: "c" },
	environment: { host: "env.example" },
};

describe("lm.globals, lm.collectionVariables, lm.environment", () => {
	it("each reads its own scope only", async () => {
		const result = await runPre(
			`lm.test("own scope", () => {
				lm.expect(lm.globals.get("host")).to.equal("global.example");
				lm.expect(lm.collectionVariables.get("host")).to.equal("collection.example");
				lm.expect(lm.environment.get("host")).to.equal("env.example");
				lm.expect(lm.environment.get("onlyGlobal")).to.equal(undefined);
				lm.expect(lm.collectionVariables.has("onlyGlobal")).to.equal(false);
			});`,
			scopes,
		);
		expect(result.error).toBeNull();
		expect(result.tests).toEqual([
			{ name: "own scope", passed: true, error: null },
		]);
	});

	it("sets, unsets and clears per scope", async () => {
		const result = await runPre(
			`lm.globals.set("token", "abc");
			lm.collectionVariables.unset("onlyCollection");
			lm.environment.clear();
			lm.environment.set("fresh", 42);`,
			scopes,
		);
		expect(result.error).toBeNull();
		expect(result.globals).toEqual({ ...scopes.globals, token: "abc" });
		expect(result.collectionVariables).toEqual({ host: "collection.example" });
		expect(result.environment).toEqual({ fresh: "42" });
	});

	it("gives a failed script's scopes back unchanged", async () => {
		const result = await runPre(
			`lm.globals.set("token", "abc"); throw new Error("stop");`,
			scopes,
		);
		expect(result.error?.code).toBe("SCRIPT_ERROR");
		expect(result.globals).toEqual(scopes.globals);
	});
});

describe("lm.variables across scopes", () => {
	it("reads a script value, then environment, collection, globals", async () => {
		const result = await runPre(
			`lm.test("precedence", () => {
				lm.expect(lm.variables.get("host")).to.equal("env.example");
				lm.expect(lm.variables.get("onlyCollection")).to.equal("c");
				lm.expect(lm.variables.get("onlyGlobal")).to.equal("g");
				lm.expect(lm.variables.has("onlyGlobal")).to.equal(true);
				lm.variables.set("host", "script.example");
				lm.expect(lm.variables.get("host")).to.equal("script.example");
				lm.expect(lm.variables.toObject()).to.deep.equal({
					host: "script.example", onlyGlobal: "g", onlyCollection: "c",
				});
			});`,
			scopes,
		);
		expect(result.tests[0]).toEqual({
			name: "precedence",
			passed: true,
			error: null,
		});
		// A script value stays in lm.variables; the environment keeps its own.
		expect(result.variables).toEqual({ host: "script.example" });
		expect(result.environment).toEqual(scopes.environment);
	});
});

describe("saved scope limits", () => {
	it("refuses names and values a local value could not hold", async () => {
		const long = await runPre(`lm.environment.set("k", "x".repeat(10001));`);
		expect(long.error?.message).toMatch(/value longer than 10000/);
		const spaced = await runPre(`lm.globals.set(" k", "v");`);
		expect(spaced.error?.message).toMatch(/starts or ends with a space/);
		const name = await runPre(
			`lm.collectionVariables.set("${"n".repeat(201)}", "v");`,
		);
		expect(name.error?.message).toMatch(/name longer than 200/);
	});

	it("takes a scope holding definitions and local values together", async () => {
		const environment = Object.fromEntries(
			Array.from({ length: 700 }, (_, i) => [`k${i}`, "v"]),
		);
		const result = await runPre(`lm.environment.get("k0");`, { environment });
		expect(result.error).toBeNull();
		expect(Object.keys(result.environment)).toHaveLength(700);
	});

	it("keeps a variable named __proto__ as data", async () => {
		const result = await runPre(
			`lm.test("proto", () => {
				lm.expect(lm.environment.toObject().__proto__).to.equal("p");
				lm.expect(lm.variables.toObject().__proto__).to.equal("p");
			});`,
			{ environment: JSON.parse('{"__proto__":"p"}') },
		);
		expect(result.tests[0]?.passed).toBe(true);
	});
});
