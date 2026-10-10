import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { TEST_SERVER_IP, testResolver } from "./proxy-test-server.js";
import { createSsrfGuard } from "./ssrf-guard.js";

async function codeOf(work: Promise<unknown>): Promise<string> {
	try {
		await work;
	} catch (error) {
		if (error instanceof OperationError) return error.code;
		throw error;
	}
	return "PINNED";
}

/** `tunnel.test` is a Tunelo domain served from the server's own IP. */
const guard = createSsrfGuard({
	resolve: testResolver,
	ownAddresses: () => [TEST_SERVER_IP],
	tunnelDomains: () => ["tunnel.test"],
});

describe("SSRF guard and Tunelo tunnel hosts", () => {
	it("lets https://<label>.<domain> reach the server, Host forced", async () => {
		for (const url of [
			"https://app.tunnel.test/users?id=1",
			"https://APP.tunnel.test:443/",
			// DNS ignores trailing dots; so does every host comparison.
			"https://app.tunnel.test./",
			"https://app.tunnel.test../",
		]) {
			const pinned = await guard.pin(new URL(url));
			expect(pinned).toMatchObject({
				address: TEST_SERVER_IP,
				hostname: "app.tunnel.test",
				port: 443,
				forceHost: true,
			});
		}
	});

	it.each([
		["the bare domain", "https://tunnel.test/"],
		["two labels deep", "https://a.b.tunnel.test/"],
		["another domain ending alike", "https://app.tunnel.test.evil/"],
		["plain http", "http://app.tunnel.test/"],
		["another port", "https://app.tunnel.test:8443/"],
	])("refuses the server's address for %s", async (_case, url) => {
		expect(await codeOf(guard.pin(new URL(url)))).toBe("PROXY_TARGET_BLOCKED");
	});

	it("keeps refusing a tunnel host on a private address", async () => {
		const url = new URL("https://priv.tunnel.test/");
		expect(await codeOf(guard.pin(url))).toBe("PROXY_TARGET_BLOCKED");
	});

	it("exempts nothing when no tunnel domain is configured", async () => {
		const none = createSsrfGuard({
			resolve: testResolver,
			ownAddresses: () => [TEST_SERVER_IP],
		});
		const url = new URL("https://app.tunnel.test/");
		expect(await codeOf(none.pin(url))).toBe("PROXY_TARGET_BLOCKED");
	});

	it("does not force Host for a public host", async () => {
		const open = createSsrfGuard({
			resolve: testResolver,
			ownAddresses: () => [],
			tunnelDomains: () => ["tunnel.test"],
		});
		const pinned = await open.pin(new URL("https://public.test/"));
		expect(pinned.forceHost).toBe(false);
	});
});
