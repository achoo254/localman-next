import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { seriousViolations } from "../../test/axe";
import { LandingPage } from "./landing-page";
import { ALL_FEATURES, renderWithFeatures } from "./landing-test-helpers";

const ORDER = new Set(["hero", "landing-live-sync", "landing-mock-mcp"]);

describe("landing block 'Instant Mock MCP'", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});

	it("is absent while the mockMcp flag is off", () => {
		const { container } = renderWithFeatures(<LandingPage />, NO_FEATURES);
		expect(container.querySelector('[data-id="landing-mock-mcp"]')).toBeNull();
	});

	it("loads after Live Mock Sync with the command and the five tools", async () => {
		const { container } = renderWithFeatures(<LandingPage />, ALL_FEATURES);
		expect(
			await screen.findByRole("heading", {
				name: "Your mock becomes a tool for AI agents",
			}),
		).toBeInTheDocument();
		const order = [...container.querySelectorAll("[data-id]")]
			.map((element) => element.getAttribute("data-id") ?? "")
			.filter((id) => ORDER.has(id));
		expect(order).toEqual(["hero", "landing-live-sync", "landing-mock-mcp"]);
		expect(
			container.querySelector('[data-id="landing-mock-mcp-snippet"] code'),
		).toHaveTextContent(
			"claude mcp add --transport http localman-mock https://a1b2c3d4.localman.hoandat.com/api/v1/mcp",
		);
		expect(
			container.querySelector('[data-id="landing-mock-mcp-snippet-copy"]'),
		).toBeInTheDocument();
		const tools = [
			...container.querySelectorAll('[data-id^="landing-mock-mcp-tool-"]'),
		].map((item) => item.getAttribute("data-id"));
		expect(tools).toEqual(
			["list", "get", "create", "update", "delete"].map(
				(action) => `landing-mock-mcp-tool-${action}_users`,
			),
		);
		const block = container.querySelector('[data-id="landing-mock-mcp"]');
		if (!block) throw new Error("no landing-mock-mcp");
		expect(await seriousViolations(block)).toEqual([]);
	});
});
