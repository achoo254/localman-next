import { describe, expect, it } from "vitest";
import { API_PROXY_KEYS, apiProxy } from "./dev-api-proxy";

/** Vite forwards a request when its path starts with a key. */
function forwardedKeys(path: string): string[] {
	return API_PROXY_KEYS.filter((key) => path.startsWith(key));
}

describe("apiProxy", () => {
	it("forwards every API key to the target", () => {
		expect(apiProxy("http://localhost:4000")).toEqual({
			"/api/": "http://localhost:4000",
			"/auth": "http://localhost:4000",
			"/mcp": "http://localhost:4000",
			"/.well-known/oauth-protected-resource": "http://localhost:4000",
		});
	});

	it("keeps SPA routes that start with 'api' on the web app", () => {
		expect(forwardedKeys("/api-client")).toEqual([]);
		expect(forwardedKeys("/api-client?tab=1")).toEqual([]);
	});

	it("still forwards the API paths", () => {
		expect(forwardedKeys("/api/v1/openapi.json")).toEqual(["/api/"]);
		expect(forwardedKeys("/api/v1/proxy")).toEqual(["/api/"]);
	});
});
