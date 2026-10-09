import { createRequestDraft } from "@localman/shared/api-client";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettledResponse } from "../workbench/workbench-types";
import { browserCorsCache } from "./cors-cache";
import { RESPONSE } from "./routed-sender-test-utils";
import {
	SETTINGS_PATH,
	renderClient,
	settingsWith,
} from "./routing-test-utils";
import { type Router, useRouter } from "./use-router";

const SETTINGS = settingsWith({ defaultRoute: "proxy", sendClientIp: false });

/** Target refuses direct sends; the API answers settings, proxy and consent. */
function stubNetwork() {
	const calls: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input), window.location.origin);
			const method = init?.method ?? "GET";
			calls.push(`${method} ${url.pathname}`);
			if (url.hostname === "api.test") throw new TypeError("Failed to fetch");
			const body =
				url.pathname === "/api/v1/proxy"
					? RESPONSE
					: url.pathname.startsWith("/api/v1/client/secret-proxy-hosts/")
						? { ...SETTINGS, secretProxyHosts: ["api.test"] }
						: SETTINGS;
			return new Response(JSON.stringify(body), {
				headers: { "Content-Type": "application/json" },
			});
		}),
	);
	return calls;
}

function mount() {
	const box: { router: Router | null } = { router: null };
	function Probe() {
		const router = useRouter();
		box.router = router;
		return <>{router.element}</>;
	}
	renderClient(<Probe />);
	if (!box.router) throw new Error("not mounted");
	return box.router;
}

afterEach(() => {
	browserCorsCache().clear();
	vi.unstubAllGlobals();
});

describe("useRouter", () => {
	it("asks in a modal before credentials go through the proxy, then remembers the host", async () => {
		const user = userEvent.setup();
		const calls = stubNetwork();
		const router = mount();
		const draft = createRequestDraft({
			url: "https://api.test/me",
			auth: { type: "bearer", token: "t0ken" },
		});
		const pending: Promise<SettledResponse>[] = [];
		act(() => {
			pending.push(
				router.sender({
					draft,
					files: new Map(),
					signal: new AbortController().signal,
				}),
			);
		});
		await screen.findByRole("dialog", { name: "Send through the proxy?" });
		await user.click(
			screen.getByRole("checkbox", { name: "Don't ask again for api.test" }),
		);
		await user.click(
			screen.getByRole("button", { name: "Send through proxy" }),
		);
		const result = await pending[0];
		expect(result).toMatchObject({ kind: "done", result: { route: "proxy" } });
		await waitFor(() =>
			expect(calls).toContain("PUT /api/v1/client/secret-proxy-hosts/api.test"),
		);
		expect(calls).toContain("POST /api/v1/proxy");
		expect(browserCorsCache().has("https://api.test")).toBe(true);
	});

	it("gives a new tab the account's default route", async () => {
		const calls = stubNetwork();
		const router = mount();
		await waitFor(() => expect(calls).toContain(`GET ${SETTINGS_PATH}`));
		await waitFor(() =>
			expect(router.newDraft().settings).toMatchObject({
				route: "proxy",
				sendClientIp: false,
			}),
		);
	});
});
