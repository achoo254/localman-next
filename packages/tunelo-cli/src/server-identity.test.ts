import { describe, expect, test } from "vitest";
import { resourceOfIssuer, serverIdentity } from "./server-identity.js";

describe("server identity", () => {
	test("tunnel.<domain> stands for auth.<domain>, by its host only", () => {
		expect(serverIdentity("https://tunnel.acme.example")).toEqual({
			issuer: "https://auth.acme.example",
			resource: "https://tunnel.acme.example",
		});
		expect(serverIdentity("wss://tunnel.hoandat.com/tunnel")).toEqual({
			issuer: "https://auth.hoandat.com",
			resource: "https://tunnel.hoandat.com",
		});
		for (const url of ["http://127.0.0.1:3001", "https://tunnel.com", "nope"]) {
			expect(serverIdentity(url), url).toBeUndefined();
		}
	});

	test("asks each IdP for its own domain's Tunelo", () => {
		expect(resourceOfIssuer("https://auth.acme.example")).toBe(
			"https://tunnel.acme.example",
		);
		expect(resourceOfIssuer("http://127.0.0.1:4500")).toBe(
			"https://tunnel.hoandat.com",
		);
	});
});
