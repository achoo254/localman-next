import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { mockFetch } from "../../../test/mock-fetch";
import { renderClient } from "../routing/routing-test-utils";
import { browserTunnelChoices } from "./auto-tunnel";
import { TunnelLinksSection } from "./tunnel-links-section";

const LINKS = "/api/v1/client/tunnel-links";
const OWN = {
	id: "m1",
	source: "self",
	deviceName: "Laptop",
	machineId: "42",
	forwardEnabled: true,
	linkedAt: "2026-11-08T08:00:00.000Z",
	revoked: false,
};
const ORIGIN = "https://m-1.tunnel.hoandat.com";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	window.localStorage.clear();
});

describe("the user's own machines", () => {
	it("turns requests to the machine's localhost off", async () => {
		const api = mockFetch({
			[`GET ${LINKS}`]: { body: { links: [OWN] } },
			[`PATCH ${LINKS}/m1`]: { body: { ...OWN, forwardEnabled: false } },
		});
		renderClient(<TunnelLinksSection />);
		const toggle = await screen.findByRole("switch", {
			name: "Send requests to localhost on Laptop",
		});
		expect(toggle).toHaveAttribute("aria-checked", "true");
		await userEvent.click(toggle);
		await waitFor(() =>
			expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({
				forwardEnabled: false,
			}),
		);
	});

	it("picks a listening port, or a typed one, and remembers the machine", async () => {
		const writeText = vi.fn(async () => undefined);
		vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
		mockFetch({
			[`GET ${LINKS}`]: { body: { links: [OWN] } },
			"GET /api/v1/client/machines/m1/ports": {
				body: { ports: [{ port: 5173, name: "node" }] },
			},
			"GET /api/v1/client/local-tunnels": {
				body: {
					tunnels: [
						{
							source: "machine",
							linkId: "m1",
							protocol: "http",
							url: ORIGIN,
							localPort: 5173,
							deviceName: "Laptop",
							basicAuth: false,
						},
					],
					failures: [],
				},
			},
		});
		renderClient(<TunnelLinksSection />);
		await userEvent.click(
			await screen.findByRole("button", { name: "Choose a port on Laptop" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "localhost on Laptop",
		});
		expect(await seriousViolations(dialog)).toEqual([]);
		await userEvent.click(await screen.findByRole("button", { name: /5173/ }));
		await waitFor(() =>
			expect(browserTunnelChoices().get("localhost:5173")).toBe(ORIGIN),
		);
		expect(writeText).toHaveBeenCalledWith("http://localhost:5173/");
	});

	it("refuses a typed port out of range", async () => {
		mockFetch({
			[`GET ${LINKS}`]: { body: { links: [OWN] } },
			"GET /api/v1/client/machines/m1/ports": { body: { ports: [] } },
		});
		renderClient(<TunnelLinksSection />);
		await userEvent.click(
			await screen.findByRole("button", { name: "Choose a port on Laptop" }),
		);
		await userEvent.type(await screen.findByRole("textbox"), "70000");
		await userEvent.click(
			screen.getByRole("button", { name: /Use localhost/ }),
		);
		expect(
			await screen.findByText("Type a port from 1 to 65535."),
		).toBeVisible();
	});

	it("shows no switch on a machine linked with a code", async () => {
		mockFetch({
			[`GET ${LINKS}`]: {
				body: { links: [{ ...OWN, source: "pairing", forwardEnabled: false }] },
			},
		});
		renderClient(<TunnelLinksSection />);
		expect(await screen.findByText("Laptop")).toBeVisible();
		expect(screen.queryByRole("switch")).toBeNull();
	});
});
