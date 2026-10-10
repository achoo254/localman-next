import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	TEST_SERVER_IP,
	testResolver,
} from "../api-client/proxy-test-server.js";
import { createSsrfGuard } from "../api-client/ssrf-guard.js";
import { normalizeCallbackUrl } from "../mock-callbacks/callback-config.js";
import {
	MOCK_DOMAIN,
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { isMockHost, normalizeBaseUrl } from "./upstream-config.js";

useMockTestKit();

const SPELLINGS = [
	`abc.${MOCK_DOMAIN}`,
	`abc.${MOCK_DOMAIN}.`,
	`ABC.${MOCK_DOMAIN.toUpperCase()}.`,
	`abc.${MOCK_DOMAIN}..`,
	`${MOCK_DOMAIN}.`,
];

describe("mock host checks ignore case and trailing dots", () => {
	it.each(SPELLINGS)("treats %s as a mock host", (host) => {
		expect(isMockHost(host)).toBe(true);
		expect(normalizeBaseUrl(`https://${host}/v1`)).toBeNull();
		expect(normalizeCallbackUrl(`https://${host}/hook`)).toBeNull();
	});

	it("refuses an upstream on a mock host spelled with a trailing dot", async () => {
		const { id } = await createMockProject();
		const res = await as(OWNER).send("put", `/projects/${id}/upstream`, {
			upstream: { kind: "url", baseUrl: `https://abc.${MOCK_DOMAIN}./` },
		});
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("pins a mock host with a trailing dot like the plain one", async () => {
		const guard = createSsrfGuard({
			resolve: testResolver,
			ownAddresses: () => [TEST_SERVER_IP],
			mockBaseDomain: () => "mock.test",
		});
		const pinned = await guard.pin(new URL("https://abc.mock.test./"));
		expect(pinned).toMatchObject({
			hostname: "abc.mock.test",
			forceHost: true,
		});
	});
});
