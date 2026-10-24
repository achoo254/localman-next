import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MockReply, mockFetch } from "../test/mock-fetch";
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

describe("useLoadedTenantInfo", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/** A fresh store: the module keeps what it read for the page's lifetime. */
	async function renderLoaded(reply: MockReply) {
		vi.resetModules();
		const { calls } = mockFetch({ "GET /api/v1/tenant": reply });
		const { useLoadedTenantInfo } = await import("./tenant-info");
		const requests = () =>
			calls.filter((call) => call.path === "/api/v1/tenant").length;
		const view = renderHook(() => useLoadedTenantInfo());
		await waitFor(() => expect(requests()).toBe(1));
		return { ...view, useLoadedTenantInfo, requests };
	}

	it("is null until the API answers, then the domain the page is on", async () => {
		const { result } = await renderLoaded({ body: ACME });
		await waitFor(() => expect(result.current).toEqual(ACME));
	});

	it.each([
		[
			"the API fails",
			{ status: 500, body: { error: { code: "INTERNAL", message: "x" } } },
		],
		[
			"the answer has no idpOrigin",
			{ body: { ...ACME, idpOrigin: undefined } },
		],
	])("stays null, never the primary domain, when %s", async (_, reply) => {
		const { result, useLoadedTenantInfo, requests } = await renderLoaded(reply);
		// Only a settled failure lets the next component ask again.
		await waitFor(() => {
			renderHook(() => useLoadedTenantInfo());
			expect(requests()).toBe(2);
		});
		expect(result.current).toBeNull();
	});
});
