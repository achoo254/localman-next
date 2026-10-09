import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { TEST_SERVER_IP, testResolver } from "./proxy-test-server.js";
import { createSsrfGuard, interfaceAddresses } from "./ssrf-guard.js";

async function errorOf(work: Promise<unknown>): Promise<OperationError> {
	try {
		await work;
	} catch (error) {
		if (error instanceof OperationError) return error;
		throw error;
	}
	throw new Error("expected a refusal");
}

const neverResolve = async (): Promise<never> => {
	throw new Error("IP literals must not be resolved");
};

describe("SSRF guard", () => {
	const guard = createSsrfGuard({ resolve: testResolver });

	it.each([
		"http://127.0.0.1/",
		"http://169.254.169.254/latest/meta-data/",
		"http://[::1]/",
		"http://10.0.0.1/",
		"http://2130706433/",
		"http://0x7f.1/",
		"http://0177.0.0.1/",
		"http://[::ffff:127.0.0.1]/",
		"http://0.0.0.0:8080/",
	])("refuses the IP literal %s without DNS", async (url) => {
		const literalGuard = createSsrfGuard({ resolve: neverResolve });
		const error = await errorOf(literalGuard.pin(new URL(url)));
		expect(error.status).toBe(403);
		expect(error.code).toBe("PROXY_TARGET_BLOCKED");
		expect(error.details).toEqual({ reason: "address" });
	});

	it("refuses a name when any of its addresses is private", async () => {
		for (const host of ["private.test", "mixed.test"]) {
			const error = await errorOf(guard.pin(new URL(`https://${host}/`)));
			expect(error.code).toBe("PROXY_TARGET_BLOCKED");
		}
	});

	it("refuses localhost through the system resolver", async () => {
		const system = createSsrfGuard();
		const error = await errorOf(system.pin(new URL("http://localhost:3000/")));
		expect(error.code).toBe("PROXY_TARGET_BLOCKED");
	});

	it("pins the checked address of a public name", async () => {
		const pinned = await guard.pin(new URL("https://public.test/users"));
		expect(pinned).toMatchObject({
			hostname: "public.test",
			address: "93.184.215.14",
			family: 4,
			port: 443,
		});
		expect(pinned.dnsMs).toBeGreaterThanOrEqual(0);
		const literal = await guard.pin(new URL("http://8.8.8.8:8080/"));
		expect(literal).toMatchObject({
			address: "8.8.8.8",
			port: 8080,
			dnsMs: null,
		});
	});

	it("refuses mail ports and keeps other ports open", async () => {
		for (const port of [25, 465, 587]) {
			const error = await errorOf(
				guard.pin(new URL(`http://public.test:${port}/`)),
			);
			expect(error.details).toEqual({ reason: "port" });
		}
		await expect(
			guard.pin(new URL("http://public.test:2525/")),
		).resolves.toBeTruthy();
	});

	it("reports unresolvable names", async () => {
		const error = await errorOf(guard.pin(new URL("http://nowhere.test/")));
		expect(error.status).toBe(502);
		expect(error.code).toBe("PROXY_DNS_FAILED");
		const empty = createSsrfGuard({ resolve: async () => [] });
		expect((await errorOf(empty.pin(new URL("http://a.test/")))).code).toBe(
			"PROXY_DNS_FAILED",
		);
	});

	it("reads the extra CIDRs at every call", async () => {
		let extra: readonly string[] = [];
		const configurable = createSsrfGuard({
			resolve: testResolver,
			extraBlocked: () => extra,
		});
		await expect(
			configurable.pin(new URL("http://public.test/")),
		).resolves.toBeTruthy();
		extra = ["93.184.215.0/24"];
		const error = await errorOf(
			configurable.pin(new URL("http://public.test/")),
		);
		expect(error.code).toBe("PROXY_TARGET_BLOCKED");
	});

	it("lets only the exact test addresses through", async () => {
		const testOnly = createSsrfGuard({
			resolve: testResolver,
			allowAddresses: ["127.0.0.1"],
		});
		await expect(
			testOnly.pin(new URL("http://127.0.0.1:1/")),
		).resolves.toBeTruthy();
		const error = await errorOf(testOnly.pin(new URL("http://127.0.0.2/")));
		expect(error.code).toBe("PROXY_TARGET_BLOCKED");
	});
});

describe("SSRF guard and the server's own addresses", () => {
	const own = createSsrfGuard({
		resolve: testResolver,
		ownAddresses: () => [TEST_SERVER_IP],
		mockBaseDomain: () => "mock.test:4100",
	});

	it("blocks every interface address of the machine by default", async () => {
		const addresses = interfaceAddresses();
		expect(addresses.some((a) => a === "127.0.0.1" || a === "::1")).toBe(true);
		const guard = createSsrfGuard({ resolve: testResolver });
		for (const address of addresses) {
			const host = address.includes(":") ? `[${address}]` : address;
			const error = await errorOf(guard.pin(new URL(`http://${host}/`)));
			expect(error.code).toBe("PROXY_TARGET_BLOCKED");
		}
	});

	it("refuses the server's address for any host but a mock host", async () => {
		for (const url of [
			`http://${TEST_SERVER_IP}/`,
			"https://public.test/",
			"https://mock.test/",
		]) {
			const error = await errorOf(own.pin(new URL(url)));
			expect(error.code).toBe("PROXY_TARGET_BLOCKED");
		}
	});

	it("lets a mock host on its default port reach the server, Host forced", async () => {
		const pinned = await own.pin(new URL("https://abc.mock.test/users"));
		expect(pinned).toMatchObject({
			address: TEST_SERVER_IP,
			hostname: "abc.mock.test",
			mockHost: true,
		});
		await expect(
			own.pin(new URL("http://abc.mock.test:80/")),
		).resolves.toBeTruthy();
	});

	it("keeps refusing a mock host on another port or a private address", async () => {
		for (const url of [
			"https://abc.mock.test:8443/",
			"https://priv.mock.test/",
		]) {
			const error = await errorOf(own.pin(new URL(url)));
			expect(error.code).toBe("PROXY_TARGET_BLOCKED");
		}
	});

	it("marks only mock hosts", async () => {
		const guard = createSsrfGuard({
			resolve: testResolver,
			ownAddresses: () => [],
			mockBaseDomain: () => "mock.test",
		});
		expect((await guard.pin(new URL("https://public.test/"))).mockHost).toBe(
			false,
		);
		expect((await guard.pin(new URL("https://mock.test/"))).mockHost).toBe(
			false,
		);
	});
});
