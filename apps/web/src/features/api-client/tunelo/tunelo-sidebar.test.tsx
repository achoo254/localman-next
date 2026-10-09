import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { mockFetch } from "../../../test/mock-fetch";
import {
	SETTINGS_PATH,
	renderClient,
	settingsWith,
	stubCanvas,
} from "../routing/routing-test-utils";
import { byDataId } from "../workbench/workbench-test-utils";
import { TuneloSidebar } from "./tunelo-sidebar";

const URL_3000 = "https://demo.tunnel.hoandat.com";
const STORED = settingsWith({
	tunnelMappings: [{ key: "localhost:3000", url: URL_3000, enabled: true }],
});
const BASE = "/api/v1/client/tunnel-mappings";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("TuneloSidebar", () => {
	it("lists the user's mappings with the steps and the warning", async () => {
		stubCanvas();
		mockFetch({ [`GET ${SETTINGS_PATH}`]: { body: STORED } });
		const { container } = renderClient(<TuneloSidebar />);
		const mapping = await screen.findByText("localhost:3000");
		expect(mapping.closest("li")).toHaveTextContent(URL_3000);
		expect(screen.getByText("tunelo http 3000")).toBeVisible();
		expect(
			screen.getByText("A tunnel opens your local service to the internet"),
		).toBeVisible();
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("turns a mapping off and deletes it", async () => {
		const user = userEvent.setup();
		const off = settingsWith({
			tunnelMappings: [
				{ key: "localhost:3000", url: URL_3000, enabled: false },
			],
		});
		const { calls } = mockFetch({
			[`GET ${SETTINGS_PATH}`]: { body: STORED },
			[`PUT ${BASE}/localhost%3A3000`]: { body: off },
			[`DELETE ${BASE}/localhost%3A3000`]: { body: settingsWith() },
		});
		renderClient(<TuneloSidebar />);
		const toggle = await screen.findByRole("switch", {
			name: "Use the tunnel for localhost:3000",
		});
		await user.click(toggle);
		await waitFor(() =>
			expect(toggle).toHaveAttribute("aria-checked", "false"),
		);
		expect(calls.at(-1)).toMatchObject({
			method: "PUT",
			body: { url: URL_3000, enabled: false },
		});
		await user.click(
			screen.getByRole("button", {
				name: "Delete the mapping of localhost:3000",
			}),
		);
		expect(await screen.findByText("No mapping yet.")).toBeVisible();
	});

	it("checks both addresses before saving a new mapping", async () => {
		const user = userEvent.setup();
		const saved = settingsWith({
			tunnelMappings: [
				{
					key: "localhost:8080",
					url: "https://api.tunnel.hoandat.com",
					enabled: true,
				},
			],
		});
		const { calls } = mockFetch({
			[`GET ${SETTINGS_PATH}`]: { body: settingsWith() },
			[`PUT ${BASE}/localhost%3A8080`]: { body: saved },
		});
		renderClient(<TuneloSidebar />);
		const form = within(byDataId("tunelo-mapping-form"));
		// The tunnel domains come with the settings.
		await waitFor(() =>
			expect(form.getByRole("button", { name: "Save mapping" })).toBeEnabled(),
		);
		const local = form.getByRole("textbox", { name: "Local address" });
		const tunnel = form.getByRole("textbox", { name: "Tunnel URL" });
		await user.type(local, "https://api.example.com");
		await user.type(tunnel, "http://api.tunnel.hoandat.com");
		await user.click(form.getByRole("button", { name: "Save mapping" }));
		expect(local).toHaveAccessibleDescription(
			/Enter an address on your machine/,
		);
		expect(tunnel).toHaveAccessibleDescription(/Paste the https URL/);
		expect(calls.filter((call) => call.method === "PUT")).toEqual([]);

		await user.clear(local);
		await user.type(local, "http://127.0.0.1:8080");
		expect(screen.getByText("tunelo http 8080")).toBeVisible();
		await user.clear(tunnel);
		await user.type(tunnel, "https://api.tunnel.hoandat.com/x");
		await user.click(form.getByRole("button", { name: "Save mapping" }));
		expect(
			await screen.findByText(
				"Requests to localhost:8080 now go through the tunnel.",
			),
		).toBeVisible();
		expect(calls.at(-1)).toMatchObject({
			path: `${BASE}/localhost%3A8080`,
			body: { url: "https://api.tunnel.hoandat.com", enabled: true },
		});
	});

	it("says no tunnel domain is set up when the server sends none", async () => {
		const { tunnelDomains: _omitted, ...older } = settingsWith();
		mockFetch({ [`GET ${SETTINGS_PATH}`]: { body: older } });
		renderClient(<TuneloSidebar />);
		const form = within(byDataId("tunelo-mapping-form"));
		const tunnel = form.getByRole("textbox", { name: "Tunnel URL" });
		await waitFor(() =>
			expect(tunnel).toHaveAccessibleDescription(
				"No tunnel domain is set up on this server yet, so a tunnel URL can't be saved.",
			),
		);
		expect(tunnel).toBeDisabled();
		expect(form.getByRole("button", { name: "Save mapping" })).toBeDisabled();
	});
});
