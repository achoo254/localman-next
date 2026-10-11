import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOG, change, openChangelog, renderShop } from "./changelog-test-utils";
import { byId, findRow } from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("changelog panel", () => {
	it("lists sessions, loads older ones and shows a diff", async () => {
		renderShop();
		const user = await openChangelog();
		const session = byId("changelog-session") as HTMLElement;
		expect(session).toHaveTextContent("Minh Anh");
		expect(session).toHaveTextContent("Renamed folder Users");
		await user.click(screen.getByRole("button", { name: "Load older" }));
		await waitFor(() =>
			expect(
				document.querySelectorAll("[data-id=changelog-session]"),
			).toHaveLength(2),
		);
		await user.click(
			within(session).getByRole("button", { name: "View diff" }),
		);
		const diff = await screen.findByRole("region", {
			name: "Changes to Users",
		});
		expect(diff.querySelector("[data-diff=removed]")).toHaveTextContent(
			'"name": "Team"',
		);
		expect(diff.querySelector("[data-diff=added]")).toHaveTextContent(
			'"name": "Users"',
		);
	});

	it("hides a diff for everyone", async () => {
		const { calls } = renderShop({
			[`POST ${LOG}/rv1/hide`]: { body: change("rv1", true) },
		});
		const user = await openChangelog();
		const hide = screen.getByRole("button", { name: "Hide diff" });
		expect(hide).toHaveAttribute(
			"title",
			expect.stringContaining("doesn't remove the data"),
		);
		await user.click(hide);
		expect(
			await screen.findByRole("button", { name: "Show diff" }),
		).toBeVisible();
		expect(
			calls.some((c) => c.method === "POST" && c.path === `${LOG}/rv1/hide`),
		).toBe(true);
	});

	it("shows Info with names and recent activity that opens the changelog", async () => {
		renderShop();
		const user = userEvent.setup();
		await user.click(await findRow("c1"));
		expect(
			await screen.findByText("Minh Anh", {
				selector: "[data-id=collection-created-by]",
			}),
		).toBeVisible();
		expect(byId("collection-updated")).toHaveTextContent("by Lan");
		const activity = byId("collection-activity") as HTMLElement;
		expect(
			await within(activity).findByText(/Renamed folder Users/),
		).toBeVisible();
		await user.click(
			within(activity).getByRole("button", { name: "Open changelog" }),
		);
		expect(
			await screen.findByRole("complementary", { name: "Changelog" }),
		).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Info" }));
		expect(byId("right-panel-info-id")).toHaveTextContent("c1");
		await user.click(screen.getByRole("button", { name: "Close panel" }));
		expect(byId("right-panel-info")).toBeNull();
	});
});
