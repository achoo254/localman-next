import { describe, expect, it } from "vitest";
import {
	agentHostAllowed,
	agentHostSchema,
	openWildcard,
} from "./secret-vault.js";

const accepts = (host: string): boolean =>
	agentHostSchema.safeParse(host).success;

describe("hosts a secret may be sent to by agents", () => {
	it("accepts exact hosts and one owner's subdomains", () => {
		for (const host of [
			"api.example.com",
			"*.example.com",
			"*.example.co.uk",
			"*.shop.com.vn",
			"my-app.herokuapp.com",
			"*.my-app.herokuapp.com",
			"localhost",
			"127.0.0.1",
			"*.Example.COM",
		]) {
			expect(accepts(host), host).toBe(true);
		}
	});

	it("refuses a wildcard over a top-level domain", () => {
		for (const host of ["*.com", "*.vn", "*.app", "*.io"]) {
			expect(accepts(host), host).toBe(false);
		}
	});

	it("refuses a wildcard over a country's second level", () => {
		for (const host of [
			"*.co.uk",
			"*.com.vn",
			"*.com.au",
			"*.org.uk",
			"*.net.vn",
			"*.gov.vn",
			"*.edu.au",
			"*.ac.uk",
		]) {
			expect(accepts(host), host).toBe(false);
		}
	});

	it("refuses a wildcard over a shared host", () => {
		for (const host of [
			"*.herokuapp.com",
			"*.vercel.app",
			"*.github.io",
			"*.ngrok-free.app",
			"*.trycloudflare.com",
			"*.loca.lt",
			"*.HerokuApp.com",
		]) {
			expect(accepts(host), host).toBe(false);
		}
	});

	it("never matches through a public-suffix wildcard saved earlier", () => {
		expect(openWildcard("*.com")).toBe(true);
		expect(agentHostAllowed("evil.com", ["*.com"])).toBe(false);
		expect(agentHostAllowed("evil.herokuapp.com", ["*.herokuapp.com"])).toBe(
			false,
		);
		expect(
			agentHostAllowed("api.example.com", ["*.com", "*.example.com"]),
		).toBe(true);
		expect(agentHostAllowed("example.com", ["*.example.com"])).toBe(false);
		expect(agentHostAllowed("API.Example.com.", ["api.example.com"])).toBe(
			true,
		);
	});
});
