import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { mockFetch } from "../../../test/mock-fetch";
import { byDataId } from "../workbench/workbench-test-utils";
import { browserCorsCache } from "./cors-cache";
import { normalizePinnedHost } from "./pinned-hosts-form";
import { RoutingSettings } from "./routing-settings";
import {
	SETTINGS_PATH,
	renderClient,
	settingsWith,
	stubCanvas,
} from "./routing-test-utils";

const STORED = settingsWith({
	routingHosts: ["legacy.test"],
	secretProxyHosts: ["api.test"],
});

afterEach(() => {
	browserCorsCache().clear();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("RoutingSettings", () => {
	it("shows the default route, pinned hosts, consented hosts and the CORS cache", async () => {
		stubCanvas();
		browserCorsCache().remember("https://cors.test");
		mockFetch({ [`GET ${SETTINGS_PATH}`]: { body: STORED } });
		const { container } = renderClient(<RoutingSettings />);
		expect(await screen.findByText("legacy.test")).toBeVisible();
		expect(screen.getByText("api.test")).toBeVisible();
		expect(screen.getByText("https://cors.test")).toBeVisible();
		expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("saves the default route and pins or unpins a host", async () => {
		const user = userEvent.setup();
		const { calls } = mockFetch({
			[`GET ${SETTINGS_PATH}`]: { body: STORED },
			[`PUT ${SETTINGS_PATH}`]: { body: { ...STORED, defaultRoute: "proxy" } },
			"PUT /api/v1/client/routing-hosts/new.test%3A8443": {
				body: { ...STORED, routingHosts: ["legacy.test", "new.test:8443"] },
			},
			"DELETE /api/v1/client/routing-hosts/legacy.test": {
				body: { ...STORED, routingHosts: [] },
			},
		});
		renderClient(<RoutingSettings />);
		await screen.findByText("legacy.test");
		await user.click(screen.getByRole("button", { name: "Proxy" }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Proxy" })).toHaveAttribute(
				"aria-pressed",
				"true",
			),
		);
		expect(calls.at(-1)?.body).toEqual({ defaultRoute: "proxy" });

		const input = screen.getByRole("textbox", { name: "Host" });
		await user.type(input, "https://bad/path");
		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(input).toHaveAccessibleDescription(/Enter a host name or IP/);
		await user.clear(input);
		await user.type(input, "New.Test:8443");
		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(await screen.findByText("new.test:8443")).toBeVisible();

		await user.click(
			screen.getByRole("button", { name: "Remove legacy.test" }),
		);
		expect(await screen.findByText("No host yet.")).toBeVisible();
	});

	it("clears the CORS cache of this browser", async () => {
		const user = userEvent.setup();
		browserCorsCache().remember("https://cors.test");
		mockFetch({ [`GET ${SETTINGS_PATH}`]: { body: STORED } });
		renderClient(<RoutingSettings />);
		const cors = within(byDataId("settings-routing-cors"));
		await user.click(cors.getByRole("button", { name: "Clear cache" }));
		expect(cors.getByText("No origin blocked.")).toBeVisible();
		expect(browserCorsCache().has("https://cors.test")).toBe(false);
	});
});

describe("normalizePinnedHost", () => {
	it("keeps host[:port] as the URL spells it and refuses the rest", () => {
		expect(normalizePinnedHost(" API.Test:8443 ")).toBe("api.test:8443");
		expect(normalizePinnedHost("api.test:80")).toBe("api.test");
		expect(normalizePinnedHost("[::1]:3000")).toBe("[::1]:3000");
		for (const bad of ["", "https://a.test", "a.test/x", "u@a.test", "a b"]) {
			expect(normalizePinnedHost(bad), bad).toBeNull();
		}
	});
});
