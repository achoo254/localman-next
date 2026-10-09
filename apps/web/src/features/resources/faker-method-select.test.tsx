import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	RESOURCES_PATH,
	openNewResource,
	renderDetail,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { filterFakerMethods } from "./faker-method-select";

describe("Faker method picker", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("filters the catalog as you type and picks with the keyboard", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const dialog = await openNewResource();
		const picker = within(dialog).getByRole("combobox", {
			name: "Faker method of avatar",
		});
		expect(picker).toHaveValue("image.avatar");
		// Closed: no listbox in the DOM and nothing to point at.
		expect(within(dialog).queryByRole("listbox", { hidden: true })).toBeNull();
		expect(picker).not.toHaveAttribute("aria-controls");
		await userEvent.click(picker);
		expect(picker).toHaveAttribute("aria-expanded", "true");
		await userEvent.type(picker, "email");
		const listbox = within(dialog).getByRole("listbox", {
			name: "Faker method of avatar",
		});
		const ids = within(listbox)
			.getAllByRole("option")
			.map((o) => o.textContent);
		expect(ids).toEqual(["internet.email", "internet.exampleEmail"]);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(picker).toHaveValue("internet.exampleEmail");
		expect(picker).toHaveAttribute("aria-expanded", "false");
		// Escape closes an open list, not the modal.
		await userEvent.click(picker);
		await userEvent.keyboard("{Escape}");
		expect(picker).toHaveAttribute("aria-expanded", "false");
		expect(
			screen.getByRole("dialog", { name: "New resource" }),
		).toBeInTheDocument();
	});
});

describe("filterFakerMethods", () => {
	it("keeps the catalog ids (Faker 5 names) and drops empty groups", () => {
		const groups = filterFakerMethods("fullname");
		expect(groups).toEqual([{ category: "name", ids: ["name.fullName"] }]);
		expect(filterFakerMethods("").flatMap((g) => g.ids).length).toBeGreaterThan(
			200,
		);
		expect(filterFakerMethods("person.")).toEqual([]);
	});
});
