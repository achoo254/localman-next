import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	byDataId,
	renderWorkbench,
	stubClientApi,
} from "./workbench-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("workbench sidebar sections", () => {
	it("switches between History, Tunelo and Routing, and hides on a second click", async () => {
		const user = userEvent.setup();
		stubClientApi();
		renderWorkbench();
		const history = await screen.findByRole("button", { name: "History" });
		const tunelo = screen.getByRole("button", { name: "Tunelo" });
		const routing = screen.getByRole("button", { name: "Routing" });
		expect(history).toHaveAttribute("aria-expanded", "true");

		await user.click(tunelo);
		expect(tunelo).toHaveAttribute("aria-expanded", "true");
		expect(history).toHaveAttribute("aria-expanded", "false");
		expect(byDataId("sidebar")).toHaveAttribute("data-section", "tunelo");
		expect(await screen.findByText("Map a local address")).toBeVisible();

		await user.click(routing);
		expect(
			await screen.findByRole("heading", { name: "Routing" }),
		).toBeVisible();

		await user.click(routing);
		expect(routing).toHaveAttribute("aria-expanded", "false");
		expect(byDataId("sidebar")).not.toBeVisible();
	});
});
