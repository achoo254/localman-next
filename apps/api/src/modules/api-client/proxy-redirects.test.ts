import { OperationError } from "@localman/operations";
import {
	type ProxyRequestInput,
	proxyRequestSchema,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { forwardRequest } from "./proxy-forwarder.js";
import {
	echoOf,
	headerValues,
	testGuard,
	useTestServer,
} from "./proxy-test-server.js";

const server = useTestServer();

function send(input: ProxyRequestInput) {
	return forwardRequest(proxyRequestSchema.parse(input), {
		guard: testGuard(),
		clientIp: null,
		forwardedProto: "https",
	});
}

async function refusal(input: ProxyRequestInput): Promise<OperationError> {
	const error = await send(input).catch((e: unknown) => e);
	if (error instanceof OperationError) return error;
	throw new Error("expected the proxy to refuse");
}

/** `/to?status=302&location=<url>` redirects there. */
function redirectUrl(location: string, status = 302): string {
	const query = new URLSearchParams({ status: String(status), location });
	return `${server.origin}/to?${query}`;
}

function useRedirectRoutes(): void {
	server.routes.set("/to", (req, res) => {
		const query = new URL(req.url ?? "/", server.origin).searchParams;
		res.writeHead(Number(query.get("status")), {
			location: query.get("location") ?? "/",
		});
		res.end("moved");
	});
	server.routes.set("/loop", (_req, res) => {
		res.writeHead(302, { location: "/loop" });
		res.end();
	});
}

describe("proxy redirects", () => {
	useRedirectRoutes();

	it("follows a redirect and reports the final URL", async () => {
		const response = await send({
			method: "GET",
			url: redirectUrl("/landed?x=1"),
		});
		expect(response.status).toBe(200);
		expect(response.finalUrl).toBe(`${server.origin}/landed?x=1`);
		expect(echoOf(response.body).path).toBe("/landed?x=1");
	});

	it("returns the 3xx itself when followRedirects is off", async () => {
		const response = await send({
			method: "GET",
			url: redirectUrl("/landed"),
			options: { followRedirects: false },
		});
		expect(response.status).toBe(302);
		expect(response.body).toBe("moved");
		expect(response.headers).toContainEqual({
			name: "location",
			value: "/landed",
		});
	});

	it("turns a 303 after POST into a GET without body or content headers", async () => {
		const response = await send({
			method: "POST",
			url: redirectUrl("/after", 303),
			headers: [
				{ name: "Content-Type", value: "application/json" },
				{ name: "X-Kept", value: "1" },
			],
			body: "{}",
			bodyType: "text",
		});
		const echo = echoOf(response.body);
		expect(echo.method).toBe("GET");
		expect(echo.bodyBase64).toBe("");
		expect(headerValues(echo, "content-type")).toEqual([]);
		expect(headerValues(echo, "x-kept")).toEqual(["1"]);
	});

	it("keeps method and body on 307", async () => {
		const response = await send({
			method: "PUT",
			url: redirectUrl("/again", 307),
			body: "same",
			bodyType: "text",
		});
		const echo = echoOf(response.body);
		expect(echo.method).toBe("PUT");
		expect(Buffer.from(echo.bodyBase64, "base64").toString()).toBe("same");
	});

	it("drops credentials when the redirect leaves the origin", async () => {
		const response = await send({
			method: "GET",
			url: redirectUrl(`http://echo.test:${server.port}/other`),
			headers: [
				{ name: "Authorization", value: "Bearer secret" },
				{ name: "Cookie", value: "sid=1" },
				{ name: "X-Kept", value: "1" },
			],
		});
		const echo = echoOf(response.body);
		expect(headerValues(echo, "authorization")).toEqual([]);
		expect(headerValues(echo, "cookie")).toEqual([]);
		expect(headerValues(echo, "x-kept")).toEqual(["1"]);
		expect(headerValues(echo, "host")).toEqual([`echo.test:${server.port}`]);
	});

	it("refuses a redirect to a private address or a name resolving to one", async () => {
		for (const location of [
			"http://10.0.0.1/admin",
			"http://169.254.169.254/latest/meta-data/",
			"http://[::1]/",
			"http://private.test/",
		]) {
			const error = await refusal({
				method: "GET",
				url: redirectUrl(location),
			});
			expect(error.code).toBe("PROXY_TARGET_BLOCKED");
		}
	});

	it("stops after 10 redirects", async () => {
		const error = await refusal({
			method: "GET",
			url: `${server.origin}/loop`,
		});
		expect(error).toMatchObject({
			status: 502,
			code: "PROXY_TOO_MANY_REDIRECTS",
			details: { max: 10 },
		});
	});

	it("returns a redirect to a non-http scheme as is", async () => {
		const response = await send({
			method: "GET",
			url: redirectUrl("ftp://files.example/a"),
		});
		expect(response.status).toBe(302);
	});
});
