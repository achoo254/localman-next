import { OperationError } from "@localman/operations";
import {
	type ProxyRequestInput,
	proxyRequestSchema,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { forwardRequest } from "./proxy-forwarder.js";
import {
	TEST_SERVER_IP,
	echoOf,
	headerValues,
	testGuard,
	useTestServer,
} from "./proxy-test-server.js";

const server = useTestServer();
/** `*.mock.test` are mock hosts; TEST_SERVER_IP is the server's own IP. */
const guard = testGuard({
	ownAddresses: () => [TEST_SERVER_IP],
	mockBaseDomain: () => "mock.test",
});

function send(input: ProxyRequestInput) {
	return forwardRequest(proxyRequestSchema.parse(input), {
		guard,
		clientIp: null,
		forwardedProto: "https",
	});
}

describe("proxied requests to mock hosts and the proxy marker", () => {
	it("forces Host to the mock host and ignores the user's override", async () => {
		const response = await send({
			method: "GET",
			url: `http://srv.mock.test:${server.port}/users`,
			headers: [{ name: "Host", value: "other-vhost.example" }],
		});
		const echo = echoOf(response.body);
		expect(headerValues(echo, "host")).toEqual([
			`srv.mock.test:${server.port}`,
		]);
	});

	it("keeps the user's Host override for other hosts", async () => {
		const response = await send({
			method: "GET",
			url: server.origin,
			headers: [{ name: "Host", value: "virtual.example" }],
		});
		expect(headerValues(echoOf(response.body), "host")).toEqual([
			"virtual.example",
		]);
	});

	it("always sends X-Localman-Proxy: 1, whatever the user wrote", async () => {
		const response = await send({
			method: "GET",
			url: server.origin,
			headers: [{ name: "X-Localman-Proxy", value: "0" }],
		});
		expect(headerValues(echoOf(response.body), "x-localman-proxy")).toEqual([
			"1",
		]);
	});

	it("checks a redirect out of a mock host like any other", async () => {
		server.routes.set("/leave", (req, res) => {
			const to = new URL(req.url ?? "/", server.origin).searchParams.get("to");
			res.writeHead(302, { location: to ?? "/" });
			res.end();
		});
		for (const to of [
			"https://public.test/",
			`http://${TEST_SERVER_IP}/`,
			"http://private.test/",
		]) {
			const query = new URLSearchParams({ to });
			const error = await send({
				method: "GET",
				url: `http://srv.mock.test:${server.port}/leave?${query}`,
			}).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(OperationError);
			expect(error).toMatchObject({ code: "PROXY_TARGET_BLOCKED" });
		}
	});
});
