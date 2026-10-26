import request from "supertest";
import { describe, expect, it } from "vitest";
import {
	testApp,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";

useDashboardTestDb(() => ({
	publicUrl: "https://localman.test",
	mockBaseDomain: "localman.test",
	tunnelDomains: ["tunnel.localman.test"],
}));

const info = (host: string) =>
	request(testApp).get("/api/v1/tenant").set("host", host);

describe("GET /tenant", () => {
	it("names the primary tenant by its whole domain, from its settings", async () => {
		const res = await info("localman.test");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			displayName: "localman.test",
			idpOrigin: "https://auth.localman.test",
			publicUrl: "https://localman.test",
			mockBaseDomain: "localman.test",
			tunnelDomain: "tunnel.localman.test",
		});
	});

	it("answers 421 on a host this deployment does not serve", async () => {
		for (const host of ["localman.acme.example", "evil.example", "1.2.3.4"]) {
			const res = await info(host);
			expect(res.status).toBe(421);
			expect(res.body.error.code).toBe("MISDIRECTED_REQUEST");
		}
	});
});
