import {
	LOG_ENVELOPE_FIELDS,
	PROXY_LOG_FIELDS,
} from "@localman/shared/data-policy";
import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { captureLogs } from "../../test-support/log-capture.js";
import { postProxy, proxyTestApp } from "./proxy-test-app.js";
import { useTestServer } from "./proxy-test-server.js";

const server = useTestServer();
const logs = captureLogs();
const app = proxyTestApp({ logger: logs.logger });
const allowed = new Set<string>([...PROXY_LOG_FIELDS, ...LOG_ENVELOPE_FIELDS]);

useDashboardTestDb();

/** Keys of the proxy's log lines that the data policy does not list. */
function unlistedKeys(): string[] {
	return logs
		.entries("proxy")
		.flatMap((entry) => Object.keys(entry))
		.filter((key) => !allowed.has(key));
}

describe("the proxy logs only what the data policy says", () => {
	it("for a request that was sent", async () => {
		logs.lines.length = 0;
		await postProxy(app, {
			method: "POST",
			url: `${server.origin}/orders?token=abc`,
			headers: [{ name: "Authorization", value: "Bearer hunter2" }],
			body: '{"card":"4111"}',
			bodyType: "text",
		}).expect(200);
		expect(logs.entries("proxy")).toHaveLength(1);
		expect(unlistedKeys()).toEqual([]);
	});

	it("for a request that was refused", async () => {
		logs.lines.length = 0;
		await postProxy(app, {
			method: "GET",
			url: "http://mail.example.com:25/",
		}).expect(403);
		const [entry] = logs.entries("proxy");
		expect(entry?.error).toBe("PROXY_TARGET_BLOCKED");
		expect(unlistedKeys()).toEqual([]);
	});

	it("hides the secrets the browser filled into the host, and never forwards them", async () => {
		logs.lines.length = 0;
		const res = await postProxy(app, {
			method: "GET",
			url: `${server.origin}/where`,
			logMask: ["127.0.0.1"],
		}).expect(200);
		const [entry] = logs.entries("proxy");
		expect(entry?.host).toBe("[secret]");
		expect(JSON.stringify(res.body)).not.toContain("logMask");
	});
});
