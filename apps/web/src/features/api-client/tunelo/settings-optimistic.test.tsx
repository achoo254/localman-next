import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { type MockReply, mockFetch } from "../../../test/mock-fetch";
import { findToast } from "../../../test/toast";
import { RoutingSettings } from "../routing/routing-settings";
import {
	SETTINGS_PATH,
	renderClient,
	settingsWith,
	stubCanvas,
} from "../routing/routing-test-utils";
import { byDataId } from "../workbench/workbench-test-utils";
import { TuneloSidebar } from "./tunelo-sidebar";

/** A route whose answers wait until the test releases them. */
function held() {
	const pending: Array<(reply: MockReply) => void> = [];
	return {
		route: () =>
			new Promise<MockReply>((resolve) => {
				pending.push(resolve);
			}),
		release: (reply: MockReply) => {
			for (const resolve of pending.splice(0)) resolve(reply);
		},
	};
}

const REFUSED: MockReply = {
	status: 500,
	body: { error: { code: "INTERNAL", message: "Settings are read-only now" } },
};
const STORED = settingsWith({
	routingHosts: ["legacy.test"],
	tunnelMappings: [
		{
			key: "localhost:3000",
			url: "https://demo.tunnel.hoandat.com",
			enabled: true,
		},
	],
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("API client settings loading and optimistic changes", () => {
	it("shows the mappings skeleton only while the settings load slowly", async () => {
		stubCanvas();
		const settings = held();
		mockFetch({ [`GET ${SETTINGS_PATH}`]: settings.route });
		const { container } = renderClient(<TuneloSidebar />);
		expect(
			document.querySelector('[data-id="settings-tunelo-mappings-loading"]'),
		).toBeNull();
		const region = await waitFor(() =>
			byDataId("settings-tunelo-mappings-loading"),
		);
		expect(region).toHaveAttribute("aria-busy", "true");
		expect(screen.queryByText("No mapping yet.")).toBeNull();
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => settings.release({ body: STORED }));
		expect(await screen.findByText("localhost:3000")).toBeVisible();
	});

	it("turns a mapping off at once and back on with a toast when refused", async () => {
		const user = userEvent.setup();
		const put = held();
		mockFetch({
			[`GET ${SETTINGS_PATH}`]: { body: STORED },
			"PUT /api/v1/client/tunnel-mappings/localhost%3A3000": put.route,
		});
		renderClient(<TuneloSidebar />);
		const toggle = await screen.findByRole("switch", {
			name: "Use the tunnel for localhost:3000",
		});
		await user.click(toggle);
		expect(toggle).toHaveAttribute("aria-checked", "false");
		expect(toggle).toBeEnabled();
		await act(async () => put.release(REFUSED));
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
		expect(await findToast("Settings are read-only now")).toBeVisible();
	});

	it("removes a pinned host at once and puts it back when refused", async () => {
		const user = userEvent.setup();
		const remove = held();
		mockFetch({
			[`GET ${SETTINGS_PATH}`]: { body: STORED },
			"DELETE /api/v1/client/routing-hosts/legacy.test": remove.route,
		});
		renderClient(<RoutingSettings />);
		await user.click(
			await screen.findByRole("button", { name: "Remove legacy.test" }),
		);
		expect(screen.queryByText("legacy.test")).toBeNull();
		await act(async () => remove.release(REFUSED));
		expect(await screen.findByText("legacy.test")).toBeVisible();
		expect(await findToast("Settings are read-only now")).toBeVisible();
	});
});
