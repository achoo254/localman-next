import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "../byte-encoding.js";
import {
	baseRequest,
	baseResponse,
	runPost,
	runPre,
} from "./script-test-utils.js";

describe("lm.expect", () => {
	it("throws on a failed assertion outside lm.test", async () => {
		const result = await runPost(
			"lm.expect(1).to.equal(1);\nlm.expect(404).to.equal(200);",
		);
		expect(result.error).toEqual({
			code: "SCRIPT_ERROR",
			message: "AssertionError: expected 404 to equal 200",
			line: 2,
		});
	});

	it("passes the supported chai-like assertions", async () => {
		const result = await runPost(`lm.test("all", () => {
			const e = lm.expect;
			e(1).to.equal(1); e({ a: [1, 2] }).to.eql({ a: [1, 2] }); e({ a: 1 }).to.deep.equal({ a: 1 });
			e(5).to.be.above(4).and.below(6); e(5).to.be.at.least(5).and.at.most(5);
			e("abc").to.include("b"); e([1, 2]).to.contain(2); e({ a: 1, b: 2 }).to.include({ a: 1 });
			e("abc").to.be.a("string"); e([]).to.be.an("array"); e(null).to.be.null; e(true).to.be.true;
			e(false).to.be.false; e(undefined).to.be.undefined; e(1).to.be.ok; e(0).to.exist; e([]).to.be.empty;
			e({ a: { b: 1 } }).to.have.property("a"); e({ a: 1 }).to.have.property("a", 1); e("ab").to.have.lengthOf(2);
			e("abc").to.match(/^a/); e(2).to.be.oneOf([1, 2]); e(1).to.not.equal(2); e(NaN).to.be.NaN;
			e(lm.response).to.have.status(200); e(1).toBe(1); e([1]).toEqual([1]); e("ab").toContain("a");
			e({ a: 1 }).toHaveProperty("a"); e(2).toBeGreaterThan(1); e(1).toBeLessThan(2);
		});`);
		expect(result.error).toBeNull();
		expect(result.tests).toEqual([{ name: "all", passed: true, error: null }]);
	});

	it.each([
		["lm.expect(1).to.equal('1')", 'expected 1 to equal "1"'],
		[
			"lm.expect({ a: 1 }).to.equal({ a: 1 })",
			'expected {"a":1} to equal {"a":1}',
		],
		["lm.expect([1]).to.eql([2])", "expected [1] to deeply equal [2]"],
		["lm.expect(1).to.not.equal(1)", "expected 1 not to equal 1"],
		["lm.expect('x').to.be.true", 'expected "x" to be true'],
		["lm.expect({}).to.have.property('a')", 'expected {} to have property "a"'],
		["lm.expect(lm.response).to.have.status(201)", "to have status 201"],
		["lm.expect(3).toBeLessThan(2)", "expected 3 to be below 2"],
	])("fails %s", async (assertion, message) => {
		const result = await runPost(`lm.test("t", () => { ${assertion}; });`);
		expect(result.error).toBeNull();
		expect(result.tests[0].passed).toBe(false);
		expect(result.tests[0].error).toContain(message);
	});
});

describe("lm.test", () => {
	it("counts passed and failed tests, each run once", async () => {
		const result = await runPost(`
			let calls = 0;
			lm.test("status", () => { calls++; lm.expect(lm.response.status).to.equal(200); });
			lm.test("throws", () => { calls++; throw new Error("nope"); });
			lm.test("async", async () => { calls++; await null; lm.expect(1).to.equal(2); });
			lm.test("async ok", async () => { calls++; await null; });
			lm.test("never settles", () => new Promise(() => {}));
			console.log(calls);`);
		expect(result.error).toBeNull();
		expect(result.tests.map((t) => [t.name, t.passed])).toEqual([
			["status", true],
			["throws", false],
			["async", false],
			["async ok", true],
			["never settles", false],
		]);
		expect(result.tests[1].error).toBe("Error: nope");
		expect(result.tests[2].error).toBe("AssertionError: expected 1 to equal 2");
		expect(result.tests[4].error).toBe("Error: the test did not finish");
		expect(result.logs[0].message).toBe("4");
	});

	it("rejects a missing callback", async () => {
		const result = await runPost("lm.test('x')");
		expect(result.error?.message).toContain("fn must be a function");
	});
});

describe("variables", () => {
	it("reads and writes environment and send-local variables", async () => {
		const input = { token: "old" };
		const result = await runPre(
			`lm.environment.set("token", "new"); lm.environment.unset("baseUrl");
			lm.variables.set("id", 42); lm.variables.set("obj", { a: 1 });
			console.log(lm.variables.get("token"), lm.variables.get("id"), lm.environment.has("baseUrl"), lm.environment.get("nope"));
			lm.environment.set("__proto__", "x");`,
			{ environment: { ...input, baseUrl: "u" }, variables: {} },
		);
		expect(result.error).toBeNull();
		expect(result.environment).toEqual(
			Object.fromEntries([
				["token", "new"],
				["__proto__", "x"],
			]),
		);
		expect(result.variables).toEqual({ id: "42", obj: '{"a":1}' });
		expect(result.logs[0].message).toBe("new 42 false undefined");
		expect(input.token).toBe("old");
	});

	it("rejects empty names and oversized values", async () => {
		const empty = await runPre("lm.environment.set(' ', 'x')");
		expect(empty.error?.message).toContain("the name is empty");
		const big = await runPre("lm.variables.set('a', 'x'.repeat(70000))");
		expect(big.error?.message).toContain("value longer than");
	});
});

describe("lm.request in a pre-request script", () => {
	it("changes method, url, headers and body before sending", async () => {
		const result = await runPre(`
			lm.request.method = "post";
			lm.request.url = lm.environment.get("baseUrl") + "/login";
			lm.request.setHeader("accept", "text/plain");
			lm.request.setHeader("X-Trace", "1");
			lm.request.body = JSON.stringify({ user: "an" });
			console.log(lm.request.getHeader("x-trace"));`);
		expect(result.error).toBeNull();
		expect(result.request).toEqual({
			method: "POST",
			url: "https://api.example.com/login",
			headers: [
				{ name: "accept", value: "text/plain" },
				{ name: "X-Trace", value: "1" },
			],
			body: '{"user":"an"}',
		});
		expect(result.logs[0].message).toBe("1");
	});

	it.each([
		["lm.request.method = 'FETCH'", "lm.request.method must be one of"],
		["lm.request.body = 5", "lm.request.body must be a string or null"],
		["lm.request.headers.push({ name: 1 })", "lm.request.headers[1]"],
	])("refuses %s", async (script, message) => {
		const result = await runPre(script);
		expect(result.error?.code).toBe("SCRIPT_ERROR");
		expect(result.error?.message).toContain(message);
		expect(result.request).toBe(baseRequest);
	});
});

describe("lm.response in a post-response script", () => {
	it("reads status, headers, body and timings", async () => {
		const result = await runPost(`
			const r = lm.response;
			const body = r.json();
			console.log(r.status, r.statusText, r.getHeader("content-type"), r.getHeader("set-cookie"));
			console.log(body.user.name, r.text().length, r.timings.total, r.size, r.headers.length);`);
		expect(result.error).toBeNull();
		expect(result.logs.map((l) => l.message)).toEqual([
			"200 OK application/json a=1",
			`An ${baseResponse.body.length} 42 48 3`,
		]);
	});

	it("keeps the response and the sent request read-only", async () => {
		const result = await runPost(`"use strict";
			lm.test("response", () => { lm.response.status = 500; });
			lm.test("request", () => { lm.request.url = "x"; });
			console.log(lm.response.status, lm.request.url);`);
		expect(result.tests.map((t) => t.passed)).toEqual([false, false]);
		expect(result.logs[0].message).toBe(`200 ${baseRequest.url}`);
		expect(result.request).toBe(baseRequest);
	});

	it("decodes a base64 body for text() and reports invalid JSON", async () => {
		const bytes = new Uint8Array([0x68, 0x69, 0xff]);
		const response = {
			...baseResponse,
			body: bytesToBase64(bytes),
			bodyEncoding: "base64" as const,
		};
		const result = await runPost(
			"console.log(lm.response.text()); lm.response.json();",
			{ response },
		);
		expect(result.logs[0].message).toBe("hi�");
		expect(result.error?.message).toContain("the body is not valid JSON");
	});

	it("has no lm.response before sending", async () => {
		const result = await runPre("console.log(typeof lm.response)");
		expect(result.logs[0].message).toBe("undefined");
	});
});
