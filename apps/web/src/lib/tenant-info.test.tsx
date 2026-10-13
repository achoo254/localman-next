import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../test/mock-fetch";
import {
	DEFAULT_TENANT_INFO,
	idpAccountUrlOf,
	useTenantInfo,
} from "./tenant-info";

const ACME = {
	displayName: "Acme",
	idpOrigin: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
	tunnelDomain: "tunnel.acme.example",
};

describe("useTenantInfo", () => {
	it("starts from the primary domain, then shows the domain the page is on", async () => {
		const { calls } = mockFetch({ "GET /api/v1/tenant": { body: ACME } });
		const { result } = renderHook(() => useTenantInfo());
		expect(result.current).toEqual(DEFAULT_TENANT_INFO);
		await waitFor(() => expect(result.current).toEqual(ACME));
		expect(idpAccountUrlOf(result.current)).toBe(
			"https://auth.acme.example/account",
		);
		// Read once per page load, whoever asks.
		renderHook(() => useTenantInfo());
		expect(calls.filter((call) => call.path === "/api/v1/tenant")).toHaveLength(
			1,
		);
	});
});
