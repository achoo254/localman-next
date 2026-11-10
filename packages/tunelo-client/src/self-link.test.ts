import { describe, expect, test } from "vitest";
import { SelfLinkError, linkMachineToApp } from "./self-link.js";

interface Seen {
	url: string;
	init: RequestInit | undefined;
}

function fakeFetch(status: number, body: unknown, seen: Seen[] = []) {
	return (async (url: URL | RequestInfo, init?: RequestInit) => {
		seen.push({ url: String(url), init });
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}) as typeof fetch;
}

const base = {
	serverUrl: "https://tunnel.example.test",
	accessToken: "jwt-of-account",
	deviceId: "tunelo.42",
	clientName: "Localman",
};

describe("linkMachineToApp", () => {
	test("posts the machine and app, returns the link", async () => {
		const seen: Seen[] = [];
		const link = await linkMachineToApp({
			...base,
			fetch: fakeFetch(
				200,
				{
					token: "tunelo_abc",
					linkId: "l1",
					forwardUrl: "https://m-1.tunnel.example.test/.tunelo/forward",
				},
				seen,
			),
		});
		expect(link).toEqual({
			token: "tunelo_abc",
			linkId: "l1",
			forwardUrl: "https://m-1.tunnel.example.test/.tunelo/forward",
		});
		expect(seen[0]?.url).toBe("https://tunnel.example.test/api/links/self");
		expect(seen[0]?.init?.method).toBe("POST");
		expect(JSON.parse(String(seen[0]?.init?.body))).toEqual({
			deviceId: "tunelo.42",
			clientName: "Localman",
		});
		const headers = new Headers(seen[0]?.init?.headers);
		expect(headers.get("authorization")).toBe("Bearer jwt-of-account");
	});

	test("a refusal carries the server's code, never the token", async () => {
		const error = await linkMachineToApp({
			...base,
			fetch: fakeFetch(403, { error: { code: "TUNELO_AUTH_003" } }),
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SelfLinkError);
		expect(error).toMatchObject({ status: 403, code: "TUNELO_AUTH_003" });
		expect(String(error)).not.toContain("jwt-of-account");
	});

	test("an answer without an https forward URL is refused", async () => {
		const error = await linkMachineToApp({
			...base,
			fetch: fakeFetch(200, {
				token: "tunelo_abc",
				linkId: "l1",
				forwardUrl: "http://m-1.example/.tunelo/forward",
			}),
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SelfLinkError);
	});
});
